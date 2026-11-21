import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type Workspace = { id: string; name: string };

/**
 * The current user's workspace. v1 assumes one per user: the personal workspace created by the
 * on_auth_user_created trigger (ADR 0004). A switcher for multiple workspaces is on the Later list.
 */
export const getCurrentWorkspace = cache(async (): Promise<Workspace> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces (id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.workspace) notFound(); // e.g. a client account without a studio: 404, not a 500
  return data.workspace;
});
