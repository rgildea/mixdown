import { expect, test } from "@playwright/test";
import { messagesTo, requestMagicLink } from "./mailpit";

const USER = "dev@example.test"; // seeded by scripts/dev-seed-users.mjs

test("signed-out visitors are sent to login, keeping their destination", async ({ page }) => {
  await page.goto("/songs");
  await expect(page).toHaveURL("/login?next=%2Fsongs");
});

test("magic link signs in; sign out signs out", async ({ page }) => {
  await page.goto(await requestMagicLink(page, USER));
  await expect(page).toHaveURL("/songs");
  await expect(page.getByRole("banner")).toContainText(USER);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/songs");
  await expect(page).toHaveURL(/\/login/);
});

test("the link works in a different browser (e.g. opened on a phone)", async ({ page, browser }) => {
  const link = await requestMagicLink(page, USER);
  const otherDevice = await browser.newContext(); // none of the requesting browser's cookies
  const phone = await otherDevice.newPage();
  await phone.goto(link);
  await expect(phone).toHaveURL("/songs");
  await expect(phone.getByRole("banner")).toContainText(USER);
  await otherDevice.close();
});

test("a used link can't be reused", async ({ page }) => {
  const link = await requestMagicLink(page, USER);
  await page.goto(link);
  await expect(page).toHaveURL("/songs");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto(link);
  await expect(page).toHaveURL("/login?error=link");
  // (getByRole("alert") also matches Next's #__next-route-announcer__)
  await expect(page.getByText("That sign-in link is invalid or has expired")).toBeVisible();
});

test("uninvited emails see the same message and get no email", async ({ page }) => {
  const stranger = `stranger-${Date.now()}@example.test`;
  await page.goto("/login");
  await page.getByLabel("Email").fill(stranger);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByRole("status")).toContainText(stranger);
  await page.waitForTimeout(1500);
  expect(await messagesTo(stranger)).toHaveLength(0);
});

test("a malformed link shows a friendly error", async ({ page }) => {
  await page.goto("/auth/callback?code=not-a-real-code");
  await expect(page).toHaveURL("/login?error=link");
});
