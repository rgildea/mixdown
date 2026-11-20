// Helpers for "malicious client" tests: Server Actions are public endpoints, so the server must
// reject tampered arguments. Next sends action arguments as a JSON array (text/plain).
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Page } from "@playwright/test";

type Args = Record<string, unknown>;

/** Rewrites the first-argument object of matching Server Action calls made by `page`. */
export async function tamperAction(page: Page, matches: (a: Args) => boolean, mutate: (a: Args) => Args) {
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return route.fallback();
    let args: unknown;
    try {
      args = JSON.parse(req.postData() ?? "");
    } catch {
      return route.fallback();
    }
    if (Array.isArray(args) && args[0] && typeof args[0] === "object" && matches(args[0] as Args)) {
      return route.continue({ postData: JSON.stringify([mutate(args[0] as Args), ...args.slice(1)]) });
    }
    return route.fallback();
  });
}

export const isCreateUploadUrl = (a: Args) => "filename" in a && !("key" in a);
export const isFinishUpload = (a: Args) => "key" in a;

let admin: { url: string; key: string } | undefined;
function localAdmin() {
  if (admin) return admin;
  const status = JSON.parse(
    execFileSync("npx", ["supabase", "status", "-o", "json"], {
      cwd: path.resolve(__dirname, "../../.."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) throw new Error("not local");
  return (admin = { url: status.API_URL, key: status.SERVICE_ROLE_KEY });
}

/** Creates a song in `email`'s workspace with admin rights (test setup only). Returns ids. */
export async function adminCreateSong(email: string, title: string) {
  const { url, key } = localAdmin();
  const h = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  const users = (await (await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers: h })).json()) as {
    users: { id: string; email: string }[];
  };
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`no local user ${email}`);
  const [member] = (await (
    await fetch(`${url}/rest/v1/workspace_members?select=workspace_id&user_id=eq.${user.id}`, { headers: h })
  ).json()) as { workspace_id: string }[];
  const [song] = (await (
    await fetch(`${url}/rest/v1/songs?select=id,workspace_id`, {
      method: "POST",
      headers: { ...h, Prefer: "return=representation" },
      body: JSON.stringify({ workspace_id: member.workspace_id, created_by: user.id, title }),
    })
  ).json()) as { id: string; workspace_id: string }[];
  return song;
}

/** Number of songs with this exact title (admin view). */
export async function adminCountSongs(title: string) {
  const { url, key } = localAdmin();
  const rows = (await (
    await fetch(`${url}/rest/v1/songs?select=id&title=eq.${encodeURIComponent(title)}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
  ).json()) as unknown[];
  return rows.length;
}
