// Minimal Mailpit API client: https://mailpit.axllent.org/docs/api-v1/
import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
const MIN_GAP_MS = 1_100; // Supabase allows one email per user per second (auth.email.max_frequency)

type Summary = { ID: string; To: { Address: string }[] };
const lastRequest = new Map<string, number>();

export async function messagesTo(email: string): Promise<Summary[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  return ((await res.json()) as { messages: Summary[] }).messages ?? [];
}

/**
 * Waits for an email to `email` that isn't in `seenIds` and returns its sign-in link.
 * Uses message IDs, not timestamps: on macOS, Docker's VM clock can drift from the host's
 * (e.g. after sleep), so comparing Mailpit's `Created` with the test's clock is unreliable.
 */
async function newLink(email: string, seenIds: Set<string>, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const fresh = (await messagesTo(email)).find((m) => !seenIds.has(m.ID));
    if (fresh) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { HTML: string };
      const href = [...msg.HTML.matchAll(/href="([^"]+)"/g)]
        .map((m) => m[1].replaceAll("&amp;", "&"))
        .find((h) => h.includes("/auth/callback?token_hash="));
      if (href) return href;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No sign-in email arrived for ${email}`);
}

/** Submits the login form for `email` and returns the magic link from the resulting email. */
export async function requestMagicLink(page: Page, email: string, path = "/login"): Promise<string> {
  const wait = (lastRequest.get(email) ?? 0) + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  await page.goto(path);
  await page.getByLabel("Email").fill(email);
  const seenIds = new Set((await messagesTo(email)).map((m) => m.ID));
  lastRequest.set(email, Date.now());
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByRole("status")).toContainText(email);
  return newLink(email, seenIds);
}

/** Signs `page` in as `email` through the real magic-link flow. */
export async function signIn(page: Page, email: string) {
  await page.goto(await requestMagicLink(page, email));
  await expect(page).toHaveURL("/songs");
}
