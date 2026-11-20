import { expect, test } from "@playwright/test";
import { closeSync, openSync, ftruncateSync, mkdirSync } from "node:fs";
import path from "node:path";
import { signIn } from "./mailpit";

const DEV = "dev@example.test";

/** A valid PCM WAV: 44-byte header + `seconds` of silence (16-bit, 44.1 kHz, stereo). */
function wav(seconds: number): Buffer {
  const data = 44100 * 2 * 2 * seconds;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0); b.writeUInt32LE(36 + data, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(44100, 24); b.writeUInt32LE(44100 * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(data, 40);
  return b;
}

async function startNewSong(page: import("@playwright/test").Page, title: string) {
  await page.goto("/songs/new");
  await page.getByLabel("Title").fill(title);
}

test("upload a WAV: progress, then the song lists its mix", async ({ page }) => {
  const title = `Upload ${Date.now()}`;
  await signIn(page, DEV);
  await startNewSong(page, title);
  await page.getByLabel(/^Mix/).setInputFiles({ name: "final mix.wav", mimeType: "audio/wav", buffer: wav(10) });
  await page.getByRole("button", { name: "Create song" }).click();

  await expect(page).toHaveURL("/songs", { timeout: 30_000 });
  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toContainText("final mix.wav");
  await expect(row).toContainText("1.7 MB");
  await expect(row).not.toContainText("No mix yet");
});

test("an MP3 uploads too", async ({ page }) => {
  const title = `MP3 ${Date.now()}`;
  await signIn(page, DEV);
  await startNewSong(page, title);
  await page.getByLabel(/^Mix/).setInputFiles({ name: "rough.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(300_000, 1) });
  await page.getByRole("button", { name: "Create song" }).click();
  await expect(page).toHaveURL("/songs", { timeout: 30_000 });
  await expect(page.getByRole("listitem").filter({ hasText: title })).toContainText("rough.mp3");
});

test("a song can be created without a mix", async ({ page }) => {
  const title = `No file ${Date.now()}`;
  await signIn(page, DEV);
  await startNewSong(page, title);
  await page.getByRole("button", { name: "Create song" }).click();
  await expect(page).toHaveURL("/songs");
  await expect(page.getByRole("listitem").filter({ hasText: title })).toContainText("No mix yet");
});

test("files over 500 MB are rejected before uploading", async ({ page }, testInfo) => {
  // Sparse file: reports 600 MB without using the disk space.
  mkdirSync(testInfo.outputDir, { recursive: true });
  const big = path.join(testInfo.outputDir, "huge.wav");
  const fd = openSync(big, "w");
  ftruncateSync(fd, 600 * 1024 * 1024);
  closeSync(fd);

  await signIn(page, DEV);
  await startNewSong(page, `Too big ${Date.now()}`);
  await page.getByLabel(/^Mix/).setInputFiles(big);
  await expect(page.getByText("That file is 600 MB. The limit is 500 MB.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create song" })).toBeDisabled();
});

test("non-audio files are rejected before uploading", async ({ page }) => {
  await signIn(page, DEV);
  await startNewSong(page, `Wrong type ${Date.now()}`);
  for (const name of ["notes.txt", "mix.aiff"]) {
    await page.getByLabel(/^Mix/).setInputFiles({ name, mimeType: "application/octet-stream", buffer: Buffer.from("x") });
    await expect(page.getByText("Only WAV or MP3 files can be uploaded.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create song" })).toBeDisabled();
  }
});
