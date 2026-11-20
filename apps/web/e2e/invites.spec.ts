import { expect, test } from "@playwright/test";
import { messagesTo, requestMagicLink } from "./mailpit";
import { adminInvite } from "./tamper";

// Invite-only is enforced by the database (ADR 0004). Inviting = adding an email to the allowlist;
// the invited person then signs in like anyone else, and their account + workspace are created.

test("an invited email can sign in for the first time and gets a studio", async ({ page }) => {
  const email = `invited-${Date.now()}@example.test`;
  await adminInvite(email);

  await page.goto(await requestMagicLink(page, email));
  await expect(page).toHaveURL("/songs");
  await expect(page.getByRole("banner")).toContainText(email);
  await expect(page.getByText("No songs yet")).toBeVisible(); // their own, empty workspace
});

test("an uninvited email gets the same message but no account and no email", async ({ page }) => {
  const email = `uninvited-${Date.now()}@example.test`;
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByRole("status")).toContainText(email); // indistinguishable from success
  await page.waitForTimeout(1500);
  expect(await messagesTo(email)).toHaveLength(0);
});

test("invites are case-insensitive", async ({ page }) => {
  const email = `MixedCase-${Date.now()}@Example.test`;
  await adminInvite(email);
  await page.goto(await requestMagicLink(page, email.toLowerCase()));
  await expect(page).toHaveURL("/songs");
});
