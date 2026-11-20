// The server must enforce every upload rule even when the browser is bypassed (ADR 0003).
// Each test lets the real UI run, then tampers with one Server Action argument or the storage
// request, exactly as a malicious client could.
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./mailpit";
import { adminCountSongs, adminCreateSong, isCreateUploadUrl, isFinishUpload, tamperAction } from "./tamper";

const DEV = "dev@example.test";
const mp3 = { name: "mix.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(2000, 1) };

async function submitNewSong(page: Page, title = `Server check ${Date.now()}`) {
  await page.goto("/songs/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Mix").setInputFiles(mp3);
  await page.getByRole("button", { name: "Create song and upload" }).click();
  return title;
}

test.beforeEach(async ({ page }) => {
  await signIn(page, DEV);
});

test("can't get an upload URL for another workspace's song", async ({ page }) => {
  const foreign = await adminCreateSong("dev2@example.test", `dev2 song ${Date.now()}`);
  await tamperAction(page, isCreateUploadUrl, (a) => ({ ...a, songId: foreign.id }));
  await submitNewSong(page);
  await expect(page.getByText("Song not found.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0); // not retryable
});

test("prototype-property extensions are rejected (x.constructor)", async ({ page }) => {
  await tamperAction(page, isCreateUploadUrl, (a) => ({ ...a, filename: "x.constructor" }));
  await submitNewSong(page);
  await expect(page.getByText("Only WAV or MP3 files can be uploaded.")).toBeVisible();
});

test("the size limit is enforced server-side", async ({ page }) => {
  await tamperAction(page, isCreateUploadUrl, (a) => ({ ...a, size: 600 * 1024 * 1024 }));
  await submitNewSong(page);
  await expect(page.getByText("That file is 600 MB. The limit is 500 MB.")).toBeVisible();
});

test("non-integer sizes are rejected", async ({ page }) => {
  await tamperAction(page, isCreateUploadUrl, (a) => ({ ...a, size: "2000" }));
  await submitNewSong(page);
  await expect(page.getByText("Invalid file.")).toBeVisible();
});

test("can't register an object key that wasn't issued for this song", async ({ page }) => {
  const foreign = await adminCreateSong("dev2@example.test", `dev2 song ${Date.now()}`);
  await tamperAction(page, isFinishUpload, (a) => ({
    ...a,
    key: `${foreign.workspace_id}/${foreign.id}/v1-00000000-0000-0000-0000-000000000000.mp3`,
  }));
  await submitNewSong(page);
  await expect(page.getByText("Invalid upload.")).toBeVisible();
});

test("finishUpload checks the stored object's size", async ({ page }) => {
  await tamperAction(page, isFinishUpload, (a) => ({ ...a, size: (a.size as number) + 1 }));
  await submitNewSong(page);
  await expect(page.getByText("The uploaded file doesn't match. Choose the file again.")).toBeVisible();
});

test("storage rejects an upload whose content type differs from the signed one", async ({ page }) => {
  await page.route("http://127.0.0.1:55340/**", (route) =>
    route.request().method() === "PUT"
      ? route.continue({ headers: { ...route.request().headers(), "content-type": "text/html" } })
      : route.fallback(),
  );
  await submitNewSong(page);
  await expect(page.getByText("The upload failed. Check your connection.")).toBeVisible();
});

test("a failed upload can be retried without creating a second song", async ({ page }) => {
  let failOnce = true;
  await page.route("http://127.0.0.1:55340/**", (route) => {
    if (route.request().method() === "PUT" && failOnce) {
      failOnce = false;
      return route.abort("connectionreset");
    }
    return route.fallback();
  });
  const title = await submitNewSong(page);
  await expect(page.getByText("The upload failed. Check your connection.")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL("/songs");
  await expect(page.getByRole("listitem").filter({ hasText: title })).toContainText("mix.mp3");
  expect(await adminCountSongs(title)).toBe(1);
});

test("a lost finishUpload response can be retried (idempotent)", async ({ page }) => {
  // Let the first finishUpload reach the server, but lose its response.
  let loseOnce = true;
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (loseOnce && req.method() === "POST" && req.headers()["next-action"] && (req.postData() ?? "").includes('"key"')) {
      loseOnce = false;
      await route.fetch(); // the server processes it…
      return route.abort("connectionreset"); // …but the browser never hears back
    }
    return route.fallback();
  });
  const title = await submitNewSong(page);
  await expect(page.getByText("Couldn't reach the server.")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL("/songs");
  await expect(page.getByRole("listitem").filter({ hasText: title })).toContainText("mix.mp3");
});
