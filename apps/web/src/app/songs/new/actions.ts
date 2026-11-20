"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { checkUpload } from "@/lib/upload-rules";
import { presignUpload, statObject } from "@/lib/r2";

// Server Actions are public endpoints: each one authorizes itself (getCurrentWorkspace) and reads
// the song through the user's Supabase client, so RLS decides access. Upload flow: ADR 0003.

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function createSong(input: {
  title: string;
  clientName: string;
}): Promise<Result<{ songId: string }>> {
  const title = input.title.trim();
  const clientName = input.clientName.trim();
  if (title.length < 1 || title.length > 200) return { ok: false, error: "Title must be 1–200 characters." };
  if (clientName.length > 200) return { ok: false, error: "Client name must be 200 characters or fewer." };

  const workspace = await getCurrentWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("songs")
    .insert({ workspace_id: workspace.id, title, client_name: clientName || null })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createSong:", error?.code, error?.message);
    return { ok: false, error: "Couldn't create the song. Try again." };
  }
  return { ok: true, songId: data.id };
}

/** Loads a song the current user can access (RLS), or null. */
async function accessibleSong(songId: string) {
  await getCurrentWorkspace(); // authenticates (redirects to /login if signed out)
  const supabase = await createClient();
  const { data } = await supabase.from("songs").select("id, workspace_id").eq("id", songId).maybeSingle();
  return data;
}

const keyPrefix = (song: { id: string; workspace_id: string }) => `${song.workspace_id}/${song.id}/v1-`;

export async function createUploadUrl(input: {
  songId: string;
  filename: string;
  size: number;
}): Promise<Result<{ url: string; key: string; contentType: string }>> {
  const check = checkUpload({ name: input.filename, size: input.size });
  if (!check.ok) return { ok: false, error: check.error };

  const song = await accessibleSong(input.songId);
  if (!song) return { ok: false, error: "Song not found." };

  const key = `${keyPrefix(song)}${randomUUID()}.${check.ext}`;
  const url = await presignUpload(key, check.contentType, input.size);
  return { ok: true, url, key, contentType: check.contentType };
}

export async function finishUpload(input: {
  songId: string;
  key: string;
  filename: string;
  size: number;
}): Promise<Result<object>> {
  const check = checkUpload({ name: input.filename, size: input.size });
  if (!check.ok) return { ok: false, error: check.error };

  const song = await accessibleSong(input.songId);
  if (!song) return { ok: false, error: "Song not found." };

  // Only accept keys we could have issued for this song (no registering arbitrary objects).
  const expected = new RegExp(`^${keyPrefix(song)}[0-9a-f-]{36}\\.${check.ext}$`);
  if (!expected.test(input.key)) return { ok: false, error: "Invalid upload." };

  // The database must never point at a missing or different file.
  const stored = await statObject(input.key);
  if (!stored) return { ok: false, error: "The upload didn't reach storage. Try again." };
  if (stored.size !== input.size || stored.contentType !== check.contentType) {
    console.error("finishUpload: mismatch", { key: input.key, stored, expectedSize: input.size });
    return { ok: false, error: "The uploaded file doesn't match. Try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mix_versions").insert({
    song_id: song.id,
    version_number: 1,
    object_key: input.key,
    original_filename: input.filename.slice(0, 255),
    mime_type: check.contentType,
    size_bytes: input.size,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "This song already has a mix." };
    console.error("finishUpload:", error.code, error.message);
    return { ok: false, error: "Couldn't save the upload. Try again." };
  }
  return { ok: true };
}
