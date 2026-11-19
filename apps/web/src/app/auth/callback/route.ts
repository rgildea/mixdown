import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Finishes a magic-link sign-in. Supports both link styles Supabase can send:
 * - `?code=…` (PKCE, the default template; must be opened in the browser that requested it)
 * - `?token_hash=…&type=…` (custom email template; works across browsers/devices)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let error: unknown = new Error("missing code");

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  }

  if (error) {
    console.warn("auth callback failed:", error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
