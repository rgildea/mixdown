import { expect, test, type Page } from "@playwright/test";
import { requestMagicLink, signIn } from "./mailpit";
import { adminCreateSong } from "./tamper";

const DEV = "dev@example.test";
const SONG_URL = /\/songs\/([0-9a-f-]{36})$/;

/** Valid 16-bit stereo 44.1 kHz WAV of silence. */
function wav(seconds: number): Buffer {
  const data = 44100 * 4 * seconds;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0); b.writeUInt32LE(36 + data, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(44100, 24); b.writeUInt32LE(44100 * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(data, 40);
  return b;
}

async function uploadSong(page: Page, title: string) {
  await page.goto("/songs/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel(/Client/).fill("P.B.");
  await page.getByLabel("Mix").setInputFiles({ name: "playback test.wav", mimeType: "audio/wav", buffer: wav(8) });
  await page.getByRole("button", { name: "Create song and upload" }).click();
  await expect(page).toHaveURL(SONG_URL, { timeout: 30_000 });
  return page.url();
}

const audio = (page: Page) => page.locator("audio");

test("after upload, the song page plays the mix", async ({ page }) => {
  const title = `Playback ${Date.now()}`;
  await signIn(page, DEV);
  await uploadSong(page, title);

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("P.B.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Mix" })).toContainText("playback test.wav");

  // The browser loads and decodes the file: duration comes from the WAV itself.
  await expect
    .poll(() => audio(page).evaluate((a: HTMLAudioElement) => a.duration), { timeout: 15_000 })
    .toBeCloseTo(8, 0);
  // And it actually plays (time advances). Muted so autoplay policy allows it.
  await audio(page).evaluate((a: HTMLAudioElement) => { a.muted = true; return a.play(); });
  await expect.poll(() => audio(page).evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0.2);
});

test("playback uses a short-lived signed URL that supports seeking, fresh on every load", async ({ page }) => {
  await signIn(page, DEV);
  const url = await uploadSong(page, `Signed ${Date.now()}`);

  const src1 = (await audio(page).getAttribute("src"))!;
  const signed = new URL(src1);
  expect(signed.searchParams.get("X-Amz-Expires")).toBe("3600");
  expect(signed.searchParams.get("X-Amz-Signature")).toBeTruthy();

  // Range requests work (needed for seeking); the unsigned URL is refused (bucket is private).
  const ranged = await page.request.get(src1, { headers: { range: "bytes=0-1023" } });
  expect(ranged.status()).toBe(206);
  const unsigned = await page.request.get(`${signed.origin}${signed.pathname}`);
  expect(unsigned.status()).toBe(403);

  await page.waitForTimeout(1100); // signatures are timestamped to the second
  await page.goto(url);
  const src2 = (await audio(page).getAttribute("src"))!;
  expect(src2).not.toBe(src1);
});

test("a song without a mix says so", async ({ page }) => {
  await signIn(page, DEV);
  const song = await adminCreateSong(DEV, `No mix ${Date.now()}`);
  await page.goto(`/songs/${song.id}`);
  await expect(page.getByText("No mix uploaded")).toBeVisible();
  await expect(audio(page)).toHaveCount(0);
});

test("another workspace's song is a 404, same as a missing one", async ({ page }) => {
  await signIn(page, DEV);
  const foreign = await adminCreateSong("dev2@example.test", `dev2 private ${Date.now()}`);
  for (const id of [foreign.id, "00000000-0000-0000-0000-000000000000", "not-a-uuid"]) {
    const res = await page.goto(`/songs/${id}`);
    expect(res?.status(), id).toBe(404);
    await expect(page.getByRole("heading", { name: "Song not found" })).toBeVisible();
    await expect(page.getByText(foreign.id)).toHaveCount(0);
  }
});

test("signed-out visitors are sent to login and come back to the song", async ({ page }) => {
  await signIn(page, DEV);
  const url = await uploadSong(page, `Return ${Date.now()}`);
  const path = new URL(url).pathname;
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto(path);
  const loginUrl = `/login?next=${encodeURIComponent(path)}`;
  await expect(page).toHaveURL(loginUrl);

  // Signing in from there returns to the song, not the list.
  await page.goto(await requestMagicLink(page, DEV, loginUrl));
  await expect(page).toHaveURL(path);
  await expect(page.locator("audio")).toBeVisible();
});

test("the song list links to each song's page", async ({ page }) => {
  const title = `Linked ${Date.now()}`;
  await signIn(page, DEV);
  const url = await uploadSong(page, title);
  await page.goto("/songs");
  await page.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new URL(url).pathname);
});
