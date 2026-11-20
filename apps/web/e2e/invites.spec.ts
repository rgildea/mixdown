import { expect, test } from "@playwright/test";
import { messagesTo, requestMagicLink } from "./mailpit";
import { adminInvite, adminInviteAndCreate, adminUserExists, publicAuth } from "./tamper";

// Invite-only, enforced by the database (ADR 0004). Inviting = allowlist + create the account in one
// step (npm run invite). The login form never creates accounts.

const unique = (tag: string) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

test("an invited person signs in and gets their own studio", async ({ page }) => {
  const email = unique("invited");
  await adminInviteAndCreate(email);
  await page.goto(await requestMagicLink(page, email));
  await expect(page).toHaveURL("/songs");
  await expect(page.getByRole("banner")).toContainText(email);
  await expect(page.getByText("No songs yet")).toBeVisible();
});

test("an uninvited email gets the same message but no account and no email", async ({ page }) => {
  const email = unique("uninvited");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByRole("status")).toContainText(email);
  await page.waitForTimeout(1500);
  expect(await messagesTo(email)).toHaveLength(0);
  expect(await adminUserExists(email)).toBe(false);
});

test("the login form never creates accounts, even for an allowlisted email", async ({ page }) => {
  const email = unique("allowlisted-only");
  await adminInvite(email); // allowlisted but no account: a state `npm run invite` never leaves behind
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByRole("status")).toContainText(email);
  await page.waitForTimeout(1500);
  expect(await adminUserExists(email)).toBe(false);
});

test("invites are case-insensitive", async ({ page }) => {
  const email = unique("MixedCase").replace("example", "Example");
  await adminInviteAndCreate(email.toLowerCase());
  await page.goto(await requestMagicLink(page, email.toLowerCase()));
  await expect(page).toHaveURL("/songs");
});

// ---------- Attacks against the public auth API (anyone has the anon key) ----------
test.describe("public auth API can't be used to get around invites", () => {
  const post = (path: string, body: unknown, token?: string, method = "POST") => {
    const { auth, anon } = publicAuth();
    return fetch(`${auth}${path}`, {
      method,
      headers: { apikey: anon, "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> }));
  };
  const passwordLogin = (email: string, password: string) => post("/token?grant_type=password", { email, password });

  test("signing up an invited person's email with a password doesn't hijack their account", async () => {
    const email = unique("victim");
    await adminInviteAndCreate(email);
    const signup = await post("/signup", { email, password: "attacker-pass-123" });
    expect(signup.json.access_token).toBeUndefined();
    const login = await passwordLogin(email, "attacker-pass-123");
    expect(login.json.access_token).toBeUndefined();
  });

  test("a stranger can't sign up with a password", async () => {
    const email = unique("stranger");
    const signup = await post("/signup", { email, password: "attacker-pass-123" });
    expect(signup.json.access_token).toBeUndefined();
    expect(await adminUserExists(email)).toBe(false);
  });

  test("a stranger can't create an account through the OTP endpoint", async () => {
    const email = unique("otp-stranger");
    await post("/otp", { email, create_user: true });
    expect(await adminUserExists(email)).toBe(false);
  });

  test("an anonymous session can't take over an invited email", async () => {
    const email = unique("anon-target");
    await adminInvite(email); // allowlisted, no account yet: the riskiest state
    const anon = await post("/signup", {});
    expect(anon.json.access_token, "anonymous sign-in should work").toBeTruthy();
    const token = anon.json.access_token as string;
    const update = await post("/user", { email }, token, "PUT");
    expect(update.json.email ?? "").not.toBe(email);
    expect(await adminUserExists(email)).toBe(false);
  });
});
