// Invite someone to Mixdown: allowlists the email AND creates the account in one step (ADR 0004),
// so there is never an invited-but-unregistered email that someone else could claim first.
//
//   npm run invite -- a@b.com             # local stack
//   npm run invite -- --remote a@b.com    # hosted; needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//                                         # in the environment, e.g. via 1Password:
//   op run --env-file=.env.invite -- npm run invite -- --remote a@b.com
//
// The person then signs in normally with a magic link.
import { ensureUser, localSupabase } from "./dev-seed-users.mjs";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const emails = args.filter((a) => a !== "--remote");
if (emails.length === 0) {
  console.error("Usage: npm run invite -- [--remote] someone@example.com [...]");
  process.exit(1);
}

let target;
if (remote) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("--remote needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
    process.exit(1);
  }
  target = { url: url.replace(/\/$/, ""), serviceKey };
} else {
  target = localSupabase();
}

for (const email of emails) {
  console.log(`${email}: ${await ensureUser(target, email.trim().toLowerCase())} (${remote ? "hosted" : "local"})`);
}
