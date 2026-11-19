import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * Data Access Layer entry point: the verified current user, or a redirect to /login.
 * `getUser()` validates the session with Supabase Auth. Deduplicated per request.
 * Reads cookies, so callers must render inside a <Suspense> boundary (Cache Components).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { id: user.id, email: user.email ?? null };
});
