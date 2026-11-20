import "server-only";
import { cache } from "react";
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
    .single();

  if (error || !data?.workspace) {
    throw new Error(`No workspace for user ${user.id}: ${error?.message ?? "missing"}`);
  }
  return data.workspace;
});
