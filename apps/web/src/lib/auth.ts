import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * Data Access Layer entry point: the verified current ENGINEER (non-anonymous), or a redirect to /login.
 * `getUser()` validates the session with Supabase Auth. Deduplicated per request, so calling
 * it from both a layout and a page costs one round-trip.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Anonymous share-link clients have a session but are not engineers.
  if (!user || user.is_anonymous) redirect("/login");
  return { id: user.id, email: user.email ?? null };
});

/** Any signed-in user, including anonymous share-link clients, or null. For client-facing pages. */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
