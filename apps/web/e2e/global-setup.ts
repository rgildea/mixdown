import { execFileSync } from "node:child_process";
import path from "node:path";

export default async function globalSetup() {
  const root = path.resolve(__dirname, "../../..");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    execFileSync("node", ["scripts/dev-seed-users.mjs"], { cwd: root, stdio: "inherit" });
  } catch {
    throw new Error("Local Supabase isn't running. Run `npm run db:start` from the repo root.");
  }
  if (url && !url.includes("127.0.0.1") && !url.includes("localhost")) {
    throw new Error(`E2E tests must target local Supabase, not ${url}`);
  }
}
