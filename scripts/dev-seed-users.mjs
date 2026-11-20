// Creates the dev users in the LOCAL Supabase stack. Refuses to run against anything else.
// Invite-only is enforced by the database (ADR 0004): an email must be on the invite list before an
// account can exist, so each user is invited (service-role RPC) and then created (admin API).
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

/**
 * Headers for admin calls. Two key formats exist:
 * - legacy JWT keys (`eyJ…`): sent as `apikey` AND `Authorization: Bearer`, and must have role service_role;
 * - new secret keys (`sb_secret_…`): sent ONLY as `apikey` (Supabase reserves Authorization for user JWTs).
 */
export function adminHeaders(serviceKey) {
  if (serviceKey.startsWith("eyJ")) {
    let role;
    try {
      role = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64url").toString()).role;
    } catch {
      role = "unreadable";
    }
    if (role !== "service_role") {
      throw new Error(`That key has role "${role}", not "service_role". Use the service_role (secret) key.`);
    }
    return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  }
  if (serviceKey.startsWith("sb_secret_")) return { apikey: serviceKey, "content-type": "application/json" };
  if (serviceKey.startsWith("sb_publishable_")) {
    throw new Error("That's the publishable (public) key. Use the secret key (sb_secret_…) or service_role.");
  }
  throw new Error("Unrecognised key format. Expected a service_role JWT (eyJ…) or a secret key (sb_secret_…).");
}

export async function inviteEmail({ url, serviceKey }, email) {
  const res = await fetch(`${url}/rest/v1/rpc/invite_user`, {
    method: "POST",
    headers: adminHeaders(serviceKey),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`Inviting ${email} failed: ${res.status} ${await res.text()}`);
}

export async function ensureUser({ url, serviceKey }, email) {
  await inviteEmail({ url, serviceKey }, email);
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(serviceKey),
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
