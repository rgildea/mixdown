import { expect, test } from "@playwright/test";
import { signIn } from "./mailpit";

/** Songs require a mix; a tiny MP3-named file is enough for list/isolation tests. */
const attachMix = (page: import("@playwright/test").Page) =>
  page.getByLabel("Mix").setInputFiles({ name: "mix.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(1000, 1) });

const DEV = "dev@example.test";
const DEV2 = "dev2@example.test"; // a different workspace

test("create a song and see it at the top of the list", async ({ page }) => {
  const title = `Test Song ${Date.now()}`;
  await signIn(page, DEV);

  await page.getByRole("link", { name: "New song" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel(/Client/).fill("T.C.");
  await attachMix(page);
  await page.getByRole("button", { name: "Create song and upload" }).click();

  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]{36}$/); // lands on the new song's page
  await page.goto("/songs");
  const first = page.getByRole("list", { name: "Songs" }).getByRole("listitem").first();
  await expect(first).toContainText(title);
  await expect(first).toContainText("T.C.");
});

test("a whitespace-only title is rejected by the server", async ({ page }) => {
  await signIn(page, DEV);
  await page.goto("/songs/new");
  await page.getByLabel("Title").fill("   "); // passes the browser's `required` check
  await attachMix(page);
  await page.getByRole("button", { name: "Create song and upload" }).click();
  await expect(page.getByText("Title must be 1–200 characters.")).toBeVisible();
  await expect(page).toHaveURL("/songs/new");
});

test("another workspace can't see my songs", async ({ page, browser }) => {
  const title = `Private Song ${Date.now()}`;
  await signIn(page, DEV);
  await page.goto("/songs/new");
  await page.getByLabel("Title").fill(title);
  await attachMix(page);
  await page.getByRole("button", { name: "Create song and upload" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible(); // its song page

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await signIn(page2, DEV2);
  await expect(page2.getByRole("heading", { name: "Songs" })).toBeVisible();
  await expect(page2.getByText(title)).toHaveCount(0);
  await other.close();
});
