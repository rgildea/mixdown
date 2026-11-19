import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { NEXT_COOKIE } from "@/lib/auth-next";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "invite"];

/**
 * Finishes an email sign-in (ADR 0009). Supports:
 * - `?token_hash=…&type=email|invite` from our email templates; works on any device
 * - `?code=…` (PKCE), the Supabase default template; only works in the requesting browser
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next") ?? request.cookies.get(NEXT_COOKIE)?.value);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let error: unknown = new Error("missing token");

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  }

  if (error) {
    console.warn("auth callback failed:", error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }
  const response = NextResponse.redirect(new URL(next, origin));
  response.cookies.delete({ name: NEXT_COOKIE, path: "/auth" });
  return response;
}
