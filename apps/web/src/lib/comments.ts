import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { CommentRow } from "@/lib/comment-rules";

/** A mix version's comments, as RLS lets the current user see them (members and active grantees). */
export async function getComments(versionId: string): Promise<CommentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, at_ms, body, author_name, created_at")
    .eq("version_id", versionId)
    .order("at_ms", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

/** The name this user gave on their last comment, to pre-fill the composer. Never their email. */
export function displayName(user: User | null): string {
  const name = user?.user_metadata?.display_name;
  return typeof name === "string" ? name : "";
}
