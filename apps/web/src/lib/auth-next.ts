/** Cookie carrying "where to go after sign-in" between /login and /auth/callback. */
export const NEXT_COOKIE = "mixdown_next";
export const NEXT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/auth",
  maxAge: 60 * 60, // matches the magic-link lifetime
};
