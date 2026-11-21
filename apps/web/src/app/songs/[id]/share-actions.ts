"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

// Share links (ADR 0005). Server Actions are public endpoints: each authorizes itself, and RLS
// (studio members only) enforces it again in the database.

type Result = { ok: true } | { ok: false; error: string };

async function ownSong(songId: unknown) {
  if (typeof songId !== "string") return null;
  const workspace = await getCurrentWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  return data ? { supabase, songId: data.id } : null;
}

export async function createShareLink(songId: string): Promise<Result> {
  const own = await ownSong(songId);
  if (!own) return { ok: false, error: "Song not found." };

  // 192 bits of randomness, URL-safe. Stored so the engineer can re-copy it (Ryan's call, ADR 0005).
  const token = randomBytes(24).toString("base64url");
  const { error } = await own.supabase.from("share_links").insert({ song_id: own.songId, token });
  // 23505 = an active link already exists (e.g. a double click): fine, the page shows it.
  if (error && error.code !== "23505") {
    console.error("createShareLink:", error.code, error.message);
    return { ok: false, error: "Couldn't create the link. Try again." };
  }
  revalidatePath(`/songs/${own.songId}`);
  return { ok: true };
}

export async function revokeShareLink(songId: string): Promise<Result> {
  const own = await ownSong(songId);
  if (!own) return { ok: false, error: "Song not found." };

  const { error } = await own.supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("song_id", own.songId)
    .is("revoked_at", null);
  if (error) {
    console.error("revokeShareLink:", error.code, error.message);
    return { ok: false, error: "Couldn't revoke the link. Try again." };
  }
  revalidatePath(`/songs/${own.songId}`);
  return { ok: true };
}
