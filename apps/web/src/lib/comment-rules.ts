// Comment rules shared by the browser (the composer) and the server (addComment). Issue #46.
// The database enforces the same bounds with CHECK constraints.

import { MAX_DURATION_MS } from "./waveform-rules";

export const MAX_BODY = 2000;
export const MAX_NAME = 80;

export type CommentRow = {
  id: string;
  at_ms: number | null;
  body: string;
  author_name: string;
  created_at: string;
};

export type NewComment = { songId: string; versionId: string; atMs: number | null; body: string; authorName: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates untrusted input (Server Action arguments). Returns a trimmed copy, or an error message. */
export function checkComment(input: unknown): NewComment | { error: string } {
  if (typeof input !== "object" || input === null) return { error: "Invalid comment." };
  const { songId, versionId, atMs, body, authorName } = input as Record<string, unknown>;
  if (typeof songId !== "string" || !UUID.test(songId) || typeof versionId !== "string" || !UUID.test(versionId)) {
    return { error: "Invalid comment." };
  }
  if (atMs !== null && (!Number.isSafeInteger(atMs) || (atMs as number) < 0 || (atMs as number) > MAX_DURATION_MS)) {
    return { error: "Invalid timestamp." };
  }
  const text = typeof body === "string" ? body.trim() : "";
  if (text.length < 1) return { error: "Write a comment first." };
  if (text.length > MAX_BODY) return { error: `Keep comments under ${MAX_BODY.toLocaleString("en-US")} characters.` };
  const name = typeof authorName === "string" ? authorName.trim() : "";
  if (name.length < 1) return { error: "Add your name so the engineer knows who's commenting." };
  if (name.length > MAX_NAME) return { error: `Keep your name under ${MAX_NAME} characters.` };
  return { songId, versionId, atMs: atMs as number | null, body: text, authorName: name };
}

/** A position in the mix: 1:23, 1:02:09. Floors, so a comment made at 1:23.9 reads 1:23 (where it is). */
export function formatTimecode(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Timeline order: whole-mix comments first, then by time, then oldest first. */
export function byTimeline(a: CommentRow, b: CommentRow): number {
  if (a.at_ms !== b.at_ms) {
    if (a.at_ms === null) return -1;
    if (b.at_ms === null) return 1;
    return a.at_ms - b.at_ms;
  }
  return a.created_at.localeCompare(b.created_at);
}
