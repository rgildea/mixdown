import { expect, test } from "@playwright/test";
import { signIn } from "./mailpit";
import { adminCreateSong } from "./tamper";

const DEV = "dev@example.test";

test("create, copy, re-copy after reload, revoke, and recreate a share link", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, DEV);
  const song = await adminCreateSong(DEV, `Shared ${Date.now()}`);
  await page.goto(`/songs/${song.id}`);

  const panel = page.getByRole("region", { name: "Share with client" });
  await panel.getByRole("button", { name: "Create share link" }).click();
  const field = panel.getByLabel("Share link");
  await expect(field).toHaveValue(/\/s\/[A-Za-z0-9_-]{32}$/);
  const url1 = await field.inputValue();

  await panel.getByRole("button", { name: "Copy link" }).click();
  await expect(panel.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url1);

  await page.reload(); // the engineer can come back and copy the same link later
  await expect(panel.getByLabel("Share link")).toHaveValue(url1);

  page.once("dialog", (d) => d.accept());
  await panel.getByRole("button", { name: "Revoke" }).click();
  await expect(panel.getByRole("button", { name: "Create share link" })).toBeVisible();

  await panel.getByRole("button", { name: "Create share link" }).click();
  await expect(field).toHaveValue(/\/s\/[A-Za-z0-9_-]{32}$/);
  expect(await field.inputValue()).not.toBe(url1); // revoked link isn't reused
});

test("cancelling the revoke confirmation keeps the link", async ({ page }) => {
  await signIn(page, DEV);
  const song = await adminCreateSong(DEV, `Keep ${Date.now()}`);
  await page.goto(`/songs/${song.id}`);
  const panel = page.getByRole("region", { name: "Share with client" });
  await panel.getByRole("button", { name: "Create share link" }).click();
  const url = await panel.getByLabel("Share link").inputValue();

  page.once("dialog", (d) => d.dismiss());
  await panel.getByRole("button", { name: "Revoke" }).click();
  await page.reload();
  await expect(panel.getByLabel("Share link")).toHaveValue(url);
});
