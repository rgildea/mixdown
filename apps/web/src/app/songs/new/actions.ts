"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { checkUpload } from "@/lib/upload-rules";
import { presignUpload, statObject } from "@/lib/r2";
import { checkWaveform } from "@/lib/waveform-rules";

// Server Actions are public endpoints and their arguments are untrusted (anyone can POST them).
// Each one authorizes itself and validates everything it is given. Upload flow: ADR 0003.

/** `retryable`: whether trying the same thing again might work (drives the "Try again" button). */
type Result<T> = ({ ok: true } & T) | { ok: false; error: string; retryable: boolean };
const fail = (error: string, retryable = false) => ({ ok: false as const, error, retryable });

export async function createSong(input: {
  title: string;
  clientName: string;
}): Promise<Result<{ songId: string }>> {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const clientName = typeof input?.clientName === "string" ? input.clientName.trim() : "";
  if (title.length < 1 || title.length > 200) return fail("Title must be 1–200 characters.");
  if (clientName.length > 200) return fail("Client name must be 200 characters or fewer.");

  const workspace = await getCurrentWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("songs")
    .insert({ workspace_id: workspace.id, title, client_name: clientName || null })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createSong:", error?.code, error?.message);
    return fail("Couldn't create the song. Try again.", true);
  }
  return { ok: true, songId: data.id };
}

/**
 * A song the current user may upload to: visible through RLS AND in the user's own workspace.
 * Read access alone isn't enough: share-link clients will be able to read songs (ADR 0005).
 */
async function uploadableSong(songId: unknown) {
  if (typeof songId !== "string") return null;
  const workspace = await getCurrentWorkspace(); // authenticates (redirects if signed out)
  const supabase = await createClient();
  const { data } = await supabase.from("songs").select("id, workspace_id").eq("id", songId).maybeSingle();
  return data && data.workspace_id === workspace.id ? data : null;
}

const keyPrefix = (song: { id: string; workspace_id: string }) => `${song.workspace_id}/${song.id}/v1-`;

export async function createUploadUrl(input: {
  songId: string;
  filename: string;
  size: number;
}): Promise<Result<{ url: string; key: string; contentType: string }>> {
  const check = checkUpload({ name: input?.filename, size: input?.size });
  if (!check.ok) return fail(check.error);

  const song = await uploadableSong(input.songId);
  if (!song) return fail("Song not found.");

  const key = `${keyPrefix(song)}${randomUUID()}.${check.ext}`;
  try {
    const url = await presignUpload(key, check.contentType, input.size);
    return { ok: true, url, key, contentType: check.contentType };
  } catch (e) {
    console.error("createUploadUrl:", e);
    return fail("Couldn't start the upload. Try again.", true);
  }
}

export async function finishUpload(input: {
  songId: string;
  key: string;
  filename: string;
  size: number;
  /** Measured by the browser from the local file (ADR 0010). Optional: absent if it couldn't scan. */
  waveform?: unknown;
}): Promise<Result<object>> {
  const check = checkUpload({ name: input?.filename, size: input?.size });
  if (!check.ok) return fail(check.error);

  const song = await uploadableSong(input.songId);
  if (!song) return fail("Song not found.");

  // Only accept keys we could have issued for this song (no registering arbitrary objects).
  const expected = new RegExp(`^${keyPrefix(song)}[0-9a-f-]{36}\\.${check.ext}$`);
  if (typeof input.key !== "string" || !expected.test(input.key)) return fail("Invalid upload.");

  // The database must never point at a missing or different file.
  let stored;
  try {
    stored = await statObject(input.key);
  } catch (e) {
    console.error("finishUpload: stat failed", e);
    return fail("Couldn't confirm the upload. Try again.", true);
  }
  if (!stored) return fail("The upload didn't reach storage. Try again.", true);
  if (stored.size !== input.size || stored.contentType !== check.contentType) {
    console.error("finishUpload: mismatch", { key: input.key, stored, expectedSize: input.size });
    return fail("The uploaded file doesn't match. Choose the file again.", true);
  }

  // Cosmetic and engineer-supplied: invalid values are dropped (no waveform), not a failed upload.
  const waveform = input.waveform == null ? null : checkWaveform(input.waveform);
  if (input.waveform != null && !waveform) console.warn("finishUpload: ignoring an invalid waveform", { key: input.key });

  const supabase = await createClient();
  const { error } = await supabase.from("mix_versions").insert({
    song_id: song.id,
    version_number: 1,
    object_key: input.key,
    original_filename: input.filename.slice(0, 255),
    mime_type: check.contentType,
    size_bytes: input.size,
    duration_ms: waveform?.durationMs ?? null,
    peaks: waveform?.peaks ?? null,
  });

  if (error?.code === "23505") {
    // The song already has its v1 mix (e.g. the first finish succeeded but its response was lost
    // and the user retried). The goal is met; the extra object is an orphan (cleanup: Later list).
    return { ok: true };
  }
  if (error) {
    console.error("finishUpload:", error.code, error.message);
    return fail("Couldn't save the upload. Try again.", true);
  }
  return { ok: true };
}
