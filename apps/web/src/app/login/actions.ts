"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { NEXT_COOKIE, NEXT_COOKIE_OPTIONS } from "@/lib/auth-next";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Enter a valid email address.", email };
  }

  // Use the origin the user is actually on (localhost, preview, or production).
  // Supabase only honours it if it matches the Redirect URLs allowlist.
  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // The redirect URL must be exactly /auth/callback: the email template appends ?token_hash=…
  // (ADR 0009). The post-login destination travels in a cookie instead. If the link is opened
  // on another device the cookie is missing and the callback falls back to /songs.
  (await cookies()).set(NEXT_COOKIE, next, NEXT_COOKIE_OPTIONS);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // invite-only (ADR 0004)
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  // Uninvited emails get an error from Supabase. Show the same message either way so the
  // form doesn't reveal who has an account. Rate limits are the exception worth surfacing.
  if (error && error.status === 429) {
    return { status: "error", message: "Too many attempts. Wait a minute and try again.", email };
  }
  if (error) console.warn("signInWithOtp:", error.status, error.code);

  return { status: "sent", email };
}
