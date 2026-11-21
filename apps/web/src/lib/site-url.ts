import "server-only";

/**
 * The public base URL of the app, for links we hand to other people (share links).
 * 1. NEXT_PUBLIC_SITE_URL, if set (inlined at build time).
 * 2. On Vercel: VERCEL_PROJECT_PRODUCTION_URL, the production domain Vercel provides at runtime,
 *    so a missing/placeholder variable can't produce a wrong link.
 * 3. localhost only in development. In production with neither, fail loudly instead of
 *    silently handing out a localhost link (which happened once).
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit && !/localhost|127\.0\.0\.1/.test(explicit)) return explicit.replace(/\/$/, "");

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction.replace(/\/$/, "")}`;

  if (explicit) return explicit.replace(/\/$/, ""); // localhost value: fine off Vercel (local dev/tests)
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("No site URL configured: set NEXT_PUBLIC_SITE_URL to the app's public URL.");
}
