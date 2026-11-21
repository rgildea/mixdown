import { expect, test, type Page } from "@playwright/test";
import { closeSync, ftruncateSync, mkdirSync, openSync, writeSync } from "node:fs";
import path from "node:path";
import { signIn } from "./mailpit";
import { adminMixWaveform, isFinishUpload, tamperAction } from "./tamper";

// Waveform peaks + duration measured in the browser at upload (ADR 0010, issue #45).
const DEV = "dev@example.test";
const SONG_URL = /\/songs\/([0-9a-f-]{36})$/;
const FIXTURES = path.join(__dirname, "fixtures");

/** WAV header for `dataBytes` of PCM. */
function wavHeader(dataBytes: number, channels: number, sampleRate: number, bits: number): Buffer {
  const block = (channels * bits) / 8;
  const b = Buffer.alloc(44);
  b.write("RIFF", 0); b.writeUInt32LE(36 + dataBytes, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * block, 28); b.writeUInt16LE(block, 32); b.writeUInt16LE(bits, 34);
  b.write("data", 36); b.writeUInt32LE(dataBytes, 40);
  return b;
}

/**
 * 24-bit stereo 48 kHz, 10 s: silence for the first 5 s, then a square wave at half scale in the RIGHT
 * channel only (so the scan must take the louder channel), with a JUNK chunk before fmt (as Pro Tools
 * and others write) so the scan must walk chunks rather than assume a 44-byte header.
 */
function quietThenLoudWav(): Buffer {
  const rate = 48000, seconds = 10, frames = rate * seconds;
  const data = Buffer.alloc(frames * 6);
  for (let f = rate * 5; f < frames; f++) data.writeIntLE(f % 100 < 50 ? 4194304 : -4194304, f * 6 + 3, 3);
  const h = wavHeader(data.length, 2, rate, 24);
  const junk = Buffer.alloc(8 + 26);
  junk.write("JUNK", 0); junk.writeUInt32LE(26, 4);
  const riff = Buffer.concat([h.subarray(0, 12), junk, h.subarray(12), data]);
  riff.writeUInt32LE(riff.length - 8, 4);
  return riff;
}

async function upload(page: Page, title: string, file: Parameters<Page["setInputFiles"]>[1]) {
  await page.goto("/songs/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Mix").setInputFiles(file);
  await page.getByRole("button", { name: "Create song and upload" }).click();
  await expect(page).toHaveURL(SONG_URL, { timeout: 120_000 });
  return SONG_URL.exec(page.url())![1];
}

test("upload measures the duration and peaks, and the song page draws the waveform", async ({ page }) => {
  await signIn(page, DEV);
  const songId = await upload(page, `Waveform ${Date.now()}`, {
    name: "quiet then loud.wav", mimeType: "audio/wav", buffer: quietThenLoudWav(),
  });

  const stored = await adminMixWaveform(songId);
  expect(stored.duration_ms).toBe(10_000);
  expect(stored.peaks).toHaveLength(2000);
  expect(Math.max(...stored.peaks!.slice(0, 990))).toBe(0); // first half silent
  expect(Math.min(...stored.peaks!.slice(1010))).toBeCloseTo(0.5, 2); // second half at half scale

  const mix = page.getByRole("region", { name: "Mix" });
  await expect(mix).toContainText("0:10");
  await expect(page.getByTestId("waveform")).toHaveAttribute("data-ready", "true");
});

test("clicking the waveform seeks, and the file is never fetched whole", async ({ page }) => {
  await signIn(page, DEV);
  await upload(page, `Seek ${Date.now()}`, { name: "seek.wav", mimeType: "audio/wav", buffer: quietThenLoudWav() });

  // wavesurfer would fetch() the file to decode it if it had no peaks; the <audio> element only
  // makes media (range) requests.
  const fetches: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.endsWith(".wav") &&["fetch", "xhr"].includes(r.resourceType())) fetches.push(r.url());
  });
  await page.reload();
  const wave = page.getByTestId("waveform");
  await expect(wave).toHaveAttribute("data-ready", "true");

  const box = (await wave.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect
    .poll(() => page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeCloseTo(7.5, 0);
  expect(fetches).toEqual([]);
});

test("a file the browser can't scan still uploads, with the plain player", async ({ page }) => {
  await signIn(page, DEV);
  // Not really an MP3, so decoding fails: the upload must not.
  const songId = await upload(page, `No scan ${Date.now()}`, {
    name: "rough.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(300_000, 1),
  });
  expect(await adminMixWaveform(songId)).toEqual({ duration_ms: null, peaks: null });
  await expect(page.getByRole("region", { name: "Mix" }).locator("audio")).toBeVisible();
  await expect(page.getByTestId("waveform")).toHaveCount(0);
});

test("a tampered waveform is dropped by the server, and the upload still succeeds", async ({ page }) => {
  await signIn(page, DEV);
  await tamperAction(page, isFinishUpload, (a) => ({ ...a, waveform: { durationMs: 10_000, peaks: [0.5, 7, "x"] } }));
  const songId = await upload(page, `Tampered ${Date.now()}`, {
    name: "t.wav", mimeType: "audio/wav", buffer: quietThenLoudWav(),
  });
  expect(await adminMixWaveform(songId)).toEqual({ duration_ms: null, peaks: null });
});

test("an MP3 gets a waveform too", async ({ page }) => {
  await signIn(page, DEV);
  const songId = await upload(page, `MP3 wave ${Date.now()}`, path.join(FIXTURES, "tone-5s.mp3"));
  const stored = await adminMixWaveform(songId);
  expect(stored.duration_ms).toBeGreaterThan(4900); // encoder padding adds a few ms
  expect(stored.duration_ms).toBeLessThan(5200);
  expect(stored.peaks).toHaveLength(2000);
  await expect(page.getByTestId("waveform")).toHaveAttribute("data-ready", "true");
});

test("a long MP3 is not decoded, however small the file (decoded size cap)", async ({ page }) => {
  await signIn(page, DEV);
  // 15 min at 8 kbps is under 1 MB but would decode to ~300 MB of PCM (PR #60 re-review).
  let decoded = false;
  await page.exposeFunction("__decodeCalled", () => (decoded = true));
  await page.addInitScript(() => {
    const original = OfflineAudioContext.prototype.decodeAudioData;
    OfflineAudioContext.prototype.decodeAudioData = function (this: OfflineAudioContext, ...args) {
      (window as unknown as { __decodeCalled: () => void }).__decodeCalled();
      return original.apply(this, args as Parameters<typeof original>);
    } as typeof original;
  });
  const songId = await upload(page, `Long MP3 ${Date.now()}`, path.join(FIXTURES, "tone-15min-8kbps.mp3"));
  expect(await adminMixWaveform(songId)).toEqual({ duration_ms: null, peaks: null });
  expect(decoded).toBe(false);
});

test("a peak too small for Postgres `real` is rounded, not a failed upload", async ({ page }) => {
  await signIn(page, DEV);
  // 1e-50 passes a 0–1 range check but Postgres rejects it as "out of range for type real" (PR #60 review).
  await tamperAction(page, isFinishUpload, (a) => ({ ...a, waveform: { durationMs: 10_000, peaks: [1e-50, 0.5] } }));
  const songId = await upload(page, `Tiny peak ${Date.now()}`, {
    name: "tiny.wav", mimeType: "audio/wav", buffer: quietThenLoudWav(),
  });
  expect(await adminMixWaveform(songId)).toEqual({ duration_ms: 10_000, peaks: [0, 0.5] });
});

test("a scan that never finishes doesn't hold up the upload", async ({ page }) => {
  test.setTimeout(60_000);
  // Some decoders have returned promises that never settle on odd input (PR #60 review).
  await page.addInitScript(() => {
    OfflineAudioContext.prototype.decodeAudioData = () => new Promise<AudioBuffer>(() => {});
  });
  await signIn(page, DEV);
  // A real MP3, so the scan gets past the metadata read to the decoder.
  const songId = await upload(page, `Stuck scan ${Date.now()}`, path.join(FIXTURES, "tone-5s.mp3"));
  expect(await adminMixWaveform(songId)).toEqual({ duration_ms: null, peaks: null });
});

test("the client's listen page draws the waveform too", async ({ page, browser }) => {
  await signIn(page, DEV);
  await upload(page, `Client wave ${Date.now()}`, { name: "c.wav", mimeType: "audio/wav", buffer: quietThenLoudWav() });
  const panel = page.getByRole("region", { name: "Share with client" });
  await panel.getByRole("button", { name: "Create share link" }).click();
  const field = panel.getByLabel("Share link");
  await expect(field).toHaveValue(/\/s\//);
  const sharePath = new URL(await field.inputValue()).pathname;

  const ctx = await browser.newContext();
  const client = await ctx.newPage();
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//);
  await expect(client.getByRole("region", { name: "Mix" })).toContainText("0:10");
  await expect(client.getByTestId("waveform")).toHaveAttribute("data-ready", "true");
  await ctx.close();
});

test("a 300 MB WAV is scanned without freezing the tab", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  mkdirSync(testInfo.outputDir, { recursive: true });
  // 24-bit stereo 48 kHz, ~18 min. Sparse file: header, then zeros (the scan still reads every byte).
  const dataBytes = Math.floor((300 * 1024 * 1024 - 44) / 6) * 6;
  const big = path.join(testInfo.outputDir, "long mix.wav");
  const fd = openSync(big, "w");
  writeSync(fd, wavHeader(dataBytes, 2, 48000, 24));
  ftruncateSync(fd, 44 + dataBytes);
  closeSync(fd);

  await signIn(page, DEV);
  await page.goto("/songs/new");
  // Heartbeat: the longest gap between timer ticks while the scan and upload run.
  await page.evaluate(() => {
    const w = window as unknown as { maxGap: number };
    w.maxGap = 0;
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      w.maxGap = Math.max(w.maxGap, now - last);
      last = now;
    }, 20);
  });
  await page.getByLabel("Title").fill(`Long ${Date.now()}`);
  await page.getByLabel("Mix").setInputFiles(big);
  await page.getByRole("button", { name: "Create song and upload" }).click();
  await expect(page.getByText("Finishing…").or(page.getByLabel("Upload progress"))).toBeVisible({ timeout: 30_000 });
  // Sample just before the app navigates away (the heartbeat dies with the page).
  let maxGap = 0;
  await expect
    .poll(
      async () => {
        maxGap = (await page.evaluate(() => (window as unknown as { maxGap?: number }).maxGap).catch(() => undefined)) ?? maxGap;
        return SONG_URL.test(page.url());
      },
      { timeout: 200_000, intervals: [250] },
    )
    .toBe(true);
  console.log(`longest main-thread gap during the 300 MB upload: ${Math.round(maxGap)} ms`);
  expect(maxGap).toBeLessThan(250);

  const songId = SONG_URL.exec(page.url())![1];
  const stored = await adminMixWaveform(songId);
  expect(stored.duration_ms).toBe(Math.round((dataBytes / 6 / 48000) * 1000));
  expect(stored.peaks).toHaveLength(2000);
  await expect(page.getByTestId("waveform")).toHaveAttribute("data-ready", "true");
});
