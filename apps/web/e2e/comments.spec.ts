import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./mailpit";

// Timestamped comments (issue #46): a client comments at a moment, the engineer sees it there.
const DEV = "dev@example.test";

/** Mono 8 kHz 16-bit WAV, a quiet square wave (so the waveform has bars). Small even at 100 s. */
function wav(seconds: number): Buffer {
  const rate = 8000, frames = rate * seconds, data = frames * 2;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0); b.writeUInt32LE(36 + data, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(data, 40);
  for (let f = 0; f < frames; f++) b.writeInt16LE(f % 80 < 40 ? 4000 : -4000, 44 + f * 2);
  return b;
}

/** Engineer uploads a 100 s mix and creates a share link. 100 s makes waveform x% = x seconds. */
async function engineerShares(page: Page, title: string) {
  await signIn(page, DEV);
  await page.goto("/songs/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Mix").setInputFiles({ name: "comment mix.wav", mimeType: "audio/wav", buffer: wav(100) });
  await page.getByRole("button", { name: "Create song and upload" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const panel = page.getByRole("region", { name: "Share with client" });
  await panel.getByRole("button", { name: "Create share link" }).click();
  const field = panel.getByLabel("Share link");
  await expect(field).toHaveValue(/\/s\//);
  return { songUrl: page.url(), sharePath: new URL(await field.inputValue()).pathname };
}

const audioTime = (page: Page) => page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime);
const audioPaused = (page: Page) => page.locator("audio").evaluate((a: HTMLAudioElement) => a.paused);

/** A seek, as the native controls would make one. */
async function seekTo(page: Page, seconds: number) {
  await page.locator("audio").evaluate((a: HTMLAudioElement, s) => (a.currentTime = s), seconds);
}

/** Clicks the waveform at `fraction` of its width (on a 100 s mix, fraction × 100 seconds). */
async function clickWaveform(wave: Locator, fraction: number) {
  const box = (await wave.boundingBox())!;
  await wave.click({ position: { x: box.width * fraction, y: box.height / 2 } });
}

test("a client comments at 1:23; the engineer sees it at 1:23 and clicking it seeks there", async ({ page, browser }) => {
  const title = `Comments ${Date.now()}`;
  const { songUrl, sharePath } = await engineerShares(page, title);

  const ctx = await browser.newContext();
  const client = await ctx.newPage();
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//);
  await expect(client.getByTestId("waveform")).toHaveAttribute("data-ready", "true");
  await expect.poll(() => client.locator("audio").evaluate((a: HTMLAudioElement) => a.duration)).toBeCloseTo(100, 0);

  // Focusing the composer captures the playhead.
  await seekTo(client, 83.4);
  await client.getByLabel("Comment", { exact: true }).focus();
  await expect(client.getByTestId("draft-time")).toContainText("1:23");
  await expect(client.getByTestId("draft-pin")).toHaveAttribute("data-at-ms", "83400");

  await client.getByLabel("Your name").fill("C.S.");
  await client.getByLabel("Comment", { exact: true }).fill("Vocal a touch loud here");
  await client.getByRole("button", { name: "Post comment" }).click();

  const list = client.getByRole("region", { name: "Comments" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("1:23");
  await expect(list).toContainText("C.S.");
  await expect(list).toContainText("Vocal a touch loud here");
  await expect(client.getByTestId("comment-pin")).toHaveAttribute("data-at-ms", "83400");
  await expect(client.getByTestId("draft-pin")).toHaveCount(0); // the draft is gone once posted

  // The name is remembered for the next comment.
  await client.reload();
  await client.getByLabel("Comment", { exact: true }).focus();
  await expect(client.getByLabel("Your name")).toHaveCount(0);
  await ctx.close();

  // The engineer sees it on the song page (after a refresh), and clicking it seeks without playing.
  await page.goto(songUrl);
  const engineerList = page.getByRole("region", { name: "Comments" });
  await expect(engineerList).toContainText("Vocal a touch loud here");
  await expect(engineerList).toContainText("C.S.");
  await expect.poll(() => page.locator("audio").evaluate((a: HTMLAudioElement) => a.duration)).toBeCloseTo(100, 0);
  await engineerList.getByRole("button", { name: "Seek to 1:23" }).click();
  await expect.poll(() => audioTime(page)).toBeCloseTo(83.4, 1);
  expect(await audioPaused(page)).toBe(true);
});

test("the draft's time: seeks move it, the × clears it, a seek brings it back, Esc cancels", async ({ page }) => {
  await engineerShares(page, `Draft ${Date.now()}`);
  const wave = page.getByTestId("waveform");
  await expect(wave).toHaveAttribute("data-ready", "true");
  await expect.poll(() => page.locator("audio").evaluate((a: HTMLAudioElement) => a.duration)).toBeCloseTo(100, 0);
  const comment = page.getByLabel("Comment", { exact: true });
  const draftTime = page.getByTestId("draft-time");

  // Seeking before a draft exists changes nothing in the composer.
  await seekTo(page, 10);
  await expect(draftTime).toHaveCount(0);

  await comment.focus();
  await expect(draftTime).toContainText("0:10");
  await comment.fill("Kick is buried");

  // Clicking the waveform with a draft open seeks, moves the draft, and does not start playback.
  await clickWaveform(wave, 0.5);
  await expect(draftTime).toContainText(/0:(49|50|51)/);
  expect(await audioPaused(page)).toBe(true);

  // × removes the time: the comment would be on the whole mix.
  await page.getByRole("button", { name: /Remove timestamp/ }).click();
  await expect(draftTime).toContainText("On the whole mix");
  await expect(page.getByTestId("draft-pin")).toHaveCount(0);

  // A seek with the draft open pins it to a time again.
  await seekTo(page, 30);
  await expect(draftTime).toContainText("0:30");

  // Esc cancels the draft; the next focus starts a fresh one at the playhead.
  await comment.press("Escape");
  await expect(draftTime).toHaveCount(0);
  await expect(comment).toHaveValue("");
  await seekTo(page, 42);
  await comment.focus();
  await expect(draftTime).toContainText("0:42");

  // A whole-mix comment, posted with the keyboard (engineers pick a display name too: no email shown).
  await page.getByRole("button", { name: /Remove timestamp/ }).click();
  if (await page.getByLabel("Your name").count()) await page.getByLabel("Your name").fill("R.G.");
  await comment.fill("Overall: great balance");
  await comment.press("ControlOrMeta+Enter");
  const list = page.getByRole("region", { name: "Comments" });
  await expect(list).toContainText("Whole mix");
  await expect(list).toContainText("Overall: great balance");
  await expect(page.getByTestId("comment-pin")).toHaveCount(0); // whole-mix comments have no pin
});
