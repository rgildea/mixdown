"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { checkComment, type CommentRow } from "@/lib/comment-rules";

// Comments (ADR 0005, #46). A Server Action is a public endpoint: it needs a session, and RLS decides
// whether that session may comment on the song (a studio member, or a client whose link is still active).

type Result = { ok: true; comment: CommentRow } | { ok: false; error: string };

export async function addComment(input: unknown): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Your session ended. Open the share link again." };
  const c = checkComment(input);
  if ("error" in c) return { ok: false, error: c.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({ song_id: c.songId, version_id: c.versionId, at_ms: c.atMs, body: c.body, author_name: c.authorName })
    .select("id, at_ms, body, author_name, created_at")
    .single();
  if (error) {
    // 42501: RLS refused (no access, or the link was revoked). 23503: the version isn't this song's.
    if (error.code === "42501" || error.code === "23503") {
      return { ok: false, error: "You can't comment on this mix any more. Ask the engineer for a new link." };
    }
    console.error("addComment:", error.code, error.message);
    return { ok: false, error: "Couldn't post your comment. Try again." };
  }

  // Remember the name for next time (pre-filled in the composer). Best effort: the comment is saved.
  if (user.user_metadata?.display_name !== c.authorName) {
    const { error: nameError } = await supabase.auth.updateUser({ data: { display_name: c.authorName } });
    if (nameError) console.error("addComment: saving display name:", nameError.message);
  }
  return { ok: true, comment: data };
}
