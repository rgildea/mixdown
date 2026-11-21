import { expect, test, type Browser, type Page } from "@playwright/test";
import { signIn } from "./mailpit";
import { adminAnonymousUserCount } from "./tamper";

// The client side of share links (ADR 0005, issue #44): no account, one click, then listen.
const DEV = "dev@example.test";

function wav(seconds: number): Buffer {
  const data = 44100 * 4 * seconds;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0); b.writeUInt32LE(36 + data, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(44100, 24); b.writeUInt32LE(44100 * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(data, 40);
  return b;
}

/** Engineer uploads a song and creates a share link; returns the song page URL and the share path. */
async function engineerShares(page: Page, title: string) {
  await signIn(page, DEV);
  await page.goto("/songs/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel(/Client/).fill("C.S.");
  await page.getByLabel("Mix").setInputFiles({ name: "client mix.wav", mimeType: "audio/wav", buffer: wav(6) });
  await page.getByRole("button", { name: "Create song and upload" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const panel = page.getByRole("region", { name: "Share with client" });
  await panel.getByRole("button", { name: "Create share link" }).click();
  const field = panel.getByLabel("Share link");
  await expect(field).toHaveValue(/\/s\//);
  return { songUrl: page.url(), sharePath: new URL(await field.inputValue()).pathname };
}

async function clientPage(browser: Browser) {
  const ctx = await browser.newContext(); // no cookies: a stranger's browser
  return { ctx, page: await ctx.newPage() };
}

test("a client opens the link, clicks Listen and the mix plays, with no account", async ({ page, browser }) => {
  const title = `Client listen ${Date.now()}`;
  const { sharePath } = await engineerShares(page, title);

  const { ctx, page: client } = await clientPage(browser);
  const anonBefore = await adminAnonymousUserCount();
  await client.goto(sharePath);
  await expect(client.getByRole("heading", { name: "A mix has been shared with you" })).toBeVisible();
  await expect(client.getByText(title)).toHaveCount(0); // nothing about the song before redeeming
  expect(await adminAnonymousUserCount()).toBe(anonBefore); // viewing the link creates no user

  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\/[0-9a-f-]{36}$/);
  await expect(client.getByRole("heading", { name: title })).toBeVisible();
  await expect(client.getByText("C.S.")).toBeVisible();
  const audio = client.locator("audio");
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.duration), { timeout: 15_000 }).toBeCloseTo(6, 0);
  await audio.evaluate((a: HTMLAudioElement) => { a.muted = true; return a.play(); });
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0.2);
  expect(await adminAnonymousUserCount()).toBe(anonBefore + 1);

  // Coming back: the link goes straight to the mix, no second anonymous user.
  await client.goto(sharePath);
  await expect(client).toHaveURL(/\/listen\//);
  expect(await adminAnonymousUserCount()).toBe(anonBefore + 1);
  await ctx.close();
});

test("revoking the link cuts the client off", async ({ page, browser }) => {
  const { sharePath } = await engineerShares(page, `Revoke me ${Date.now()}`);
  const { ctx, page: client } = await clientPage(browser);
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//);
  const listenUrl = client.url();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("region", { name: "Share with client" }).getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByRole("button", { name: "Create share link" })).toBeVisible();

  const res = await client.goto(listenUrl);
  expect(res?.status()).toBe(404);
  await expect(client.getByRole("heading", { name: "This mix isn't available" })).toBeVisible();
  await expect(client.locator("audio")).toHaveCount(0);
  await client.goto(sharePath);
  await expect(client.getByRole("heading", { name: "This link is no longer active" })).toBeVisible();
  await ctx.close();
});

test("a malformed or unknown link says so", async ({ browser }) => {
  const { ctx, page: client } = await clientPage(browser);
  await client.goto("/s/not-a-token");
  await expect(client.getByRole("heading", { name: "This link isn't valid" })).toBeVisible();
  await client.goto(`/s/${"x".repeat(32)}`);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client.getByText("This link is no longer active. Ask for a new one.")).toBeVisible();
  await ctx.close();
});

test("an anonymous client can't use the engineer pages", async ({ page, browser }) => {
  const { songUrl, sharePath } = await engineerShares(page, `Engineer only ${Date.now()}`);
  const { ctx, page: client } = await clientPage(browser);
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//);

  await client.goto(songUrl); // the engineer's page for the very song they can listen to
  await expect(client).toHaveURL(/\/login/);
  await client.goto("/songs");
  await expect(client).toHaveURL(/\/login/);
  await ctx.close();
});

test("the engineer opening their own link sees the client view", async ({ page }) => {
  const title = `Own link ${Date.now()}`;
  const { sharePath } = await engineerShares(page, title);
  await page.goto(sharePath); // already signed in: straight through
  await expect(page).toHaveURL(/\/listen\//);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});
