import { expect, test, type Browser, type Page } from "@playwright/test";
import { signIn } from "./mailpit";
import { adminActiveLinkCount, adminAnonymousUserCount, adminDeleteNewestAnonymousUser, adminGrantCount } from "./tamper";

// The client side of share links (ADR 0005, issue #44): no account, one click, then listen.
const DEV = "dev@example.test";

/** Request headers minus the cookie, so a replay carries the replaying browser's session instead. */
const withoutCookie = (h: Record<string, string>) =>
  Object.fromEntries(Object.entries(h).filter(([k]) => k.toLowerCase() !== "cookie"));

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

  // Coming back: one more click, same anonymous user (the session is reused, not recreated).
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
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
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client.getByText("This link is no longer active. Ask for a new one.")).toBeVisible();
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
  await page.goto(sharePath);
  await page.getByRole("button", { name: "Listen" }).click(); // signed in already: no anonymous user needed
  await expect(page).toHaveURL(/\/listen\//);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("loading the link has no side effects, even for someone already signed in", async ({ page, browser }) => {
  const { songUrl, sharePath } = await engineerShares(page, `No GET writes ${Date.now()}`);
  const songId = songUrl.split("/").pop()!;
  const other = await browser.newContext(); // another studio's engineer, signed in
  const otherPage = await other.newPage();
  await signIn(otherPage, "dev2@example.test");
  await otherPage.goto(sharePath);
  await expect(otherPage.getByRole("button", { name: "Listen" })).toBeVisible();
  expect(await adminGrantCount(songId)).toBe(0); // nothing redeemed just by loading
  await other.close();
});

test("the redeem action never creates users: replayed without a session it is refused", async ({ page, browser }) => {
  const { sharePath } = await engineerShares(page, `Replay redeem ${Date.now()}`);
  const { ctx, page: client } = await clientPage(browser);

  // Capture the real redeem Server Action request from a normal client click.
  let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
  client.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"] && !captured) {
      captured = { url: r.url(), headers: r.headers(), body: r.postData() ?? "" };
    }
  });
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//);
  expect(captured).not.toBeNull();

  // Replay it from a browser with no cookies: no session → refused, and no anonymous user is created.
  const stranger = await browser.newContext();
  const anonBefore = await adminAnonymousUserCount();
  const headers = withoutCookie(captured!.headers);
  const res = await stranger.request.post(captured!.url, { headers, data: captured!.body });
  expect(await adminAnonymousUserCount(), "the replayed action must not create an anonymous user").toBe(anonBefore);
  expect(await res.text()).toContain("listening session");
  await stranger.close();
  await ctx.close();
});

test("engineer Server Actions refuse an anonymous session (with a positive control)", async ({ page, browser }) => {
  const { songUrl, sharePath } = await engineerShares(page, `Anon action ${Date.now()}`);
  const songId = songUrl.split("/").pop()!;

  // An anonymous client with a real session (they opened the share link).
  const { ctx, page: client } = await clientPage(browser);
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//);

  // Capture the engineer's real "create share link" Server Action request: revoke, create, revoke.
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) {
      calls.push({ url: r.url(), headers: r.headers(), body: r.postData() ?? "" });
    }
  });
  const panel = page.getByRole("region", { name: "Share with client" });
  page.once("dialog", (d) => d.accept());
  await panel.getByRole("button", { name: "Revoke" }).click();
  await panel.getByRole("button", { name: "Create share link" }).click();
  await expect(panel.getByLabel("Share link")).toHaveValue(/\/s\//);
  const createCall = calls.at(-1)!;
  expect(createCall.body).toContain(songId);
  page.once("dialog", (d) => d.accept());
  await panel.getByRole("button", { name: "Revoke" }).click();
  await expect(panel.getByRole("button", { name: "Create share link" })).toBeVisible();
  expect(await adminActiveLinkCount(songId)).toBe(0);

  // Replay it with the ANONYMOUS client's session. Posted to "/" so the proxy's redirect for /songs/**
  // can't mask what the action itself does.
  const headers = withoutCookie(createCall.headers);
  const target = new URL("/", createCall.url).toString();
  await ctx.request.post(target, { headers, data: createCall.body });
  expect(await adminActiveLinkCount(songId)).toBe(0); // refused: no link created

  // Positive control: the same replay with the ENGINEER's session does create a link, so the replay
  // mechanism works and the refusal above is meaningful.
  await page.request.post(target, { headers, data: createCall.body });
  expect(await adminActiveLinkCount(songId)).toBe(1);
  await ctx.close();
});

test("a stale session (its anonymous user was deleted) recovers instead of getting stuck", async ({ page, browser }) => {
  const { sharePath } = await engineerShares(page, `Stale session ${Date.now()}`);
  const { ctx, page: client } = await clientPage(browser);
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//);

  await adminDeleteNewestAnonymousUser(); // e.g. a future cleanup job; the browser still holds the cookie
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//); // a fresh anonymous session, not "Try again"
  await ctx.close();
});

test("a failed session check (offline, 5xx) keeps the client's session instead of replacing it", async ({ page, browser }) => {
  const { sharePath } = await engineerShares(page, `Flaky check ${Date.now()}`);
  const { ctx, page: client } = await clientPage(browser);
  await client.goto(sharePath);
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//);
  const anon = await adminAnonymousUserCount();

  // Supabase's "who am I" check fails once: first the network, then a server error.
  for (const fail of ["abort", "500"] as const) {
    await client.route("**/auth/v1/user", (r) => (fail === "abort" ? r.abort() : r.fulfill({ status: 500, body: "{}" })), { times: 1 });
    await client.goto(sharePath);
    await client.getByRole("button", { name: "Listen" }).click();
    await expect(client.getByText("Couldn't reach the server. Try again.")).toBeVisible();
    expect(await adminAnonymousUserCount()).toBe(anon); // no new identity
  }

  // The next click works with the SAME session: still no new anonymous user.
  await client.getByRole("button", { name: "Listen" }).click();
  await expect(client).toHaveURL(/\/listen\//);
  expect(await adminAnonymousUserCount()).toBe(anon);
  await ctx.close();
});
