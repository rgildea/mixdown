// Creates the dev users in the LOCAL Supabase stack. Refuses to run against anything else.
// Signups are disabled (ADR 0004), so users must be created with the admin API.
// Extra users: `npm run db:users -- someone@example.test other@example.test`
import { execFileSync } from "node:child_process";

export const DEV_USERS = ["dev@example.test", "dev2@example.test"];

export function localSupabase() {
  let status;
  try {
    status = JSON.parse(
      execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
    );
  } catch {
    console.error("Local Supabase isn't running. Start it with `npm run db:start`.");
    process.exit(1);
  }
  const url = status.API_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) {
    throw new Error(`Refusing to seed non-local Supabase at ${url}`);
  }
  return { url, serviceKey: status.SERVICE_ROLE_KEY, anonKey: status.ANON_KEY };
}

export async function ensureUser({ url, serviceKey }, email) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (res.ok) return "created";
  const body = await res.json().catch(() => ({}));
  if (res.status === 422 && /already/i.test(body.msg ?? body.message ?? "")) return "exists";
  throw new Error(`Creating ${email} failed: ${res.status} ${JSON.stringify(body)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sb = localSupabase();
  const emails = [...DEV_USERS, ...process.argv.slice(2)];
  for (const email of emails) console.log(`${email}: ${await ensureUser(sb, email)}`);
}
