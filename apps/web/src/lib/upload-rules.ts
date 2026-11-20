// Upload rules shared by the browser (early, friendly errors) and the server (enforcement).
// ADR 0003: WAV or MP3, at most 500 MB.

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** Canonical MIME type per accepted extension. Browsers disagree on WAV MIME types
 * (audio/wav, audio/x-wav, audio/wave, audio/vnd.wave, or empty), so we go by extension and
 * always store and sign the canonical type. */
const TYPES = { wav: "audio/wav", mp3: "audio/mpeg" } as const;
export type UploadContentType = (typeof TYPES)[keyof typeof TYPES];
export const ACCEPT_ATTR = ".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg";

export type UploadCheck =
  | { ok: true; contentType: UploadContentType; ext: keyof typeof TYPES }
  | { ok: false; error: string };

export function checkUpload(file: { name: unknown; size: unknown }): UploadCheck {
  // Server Actions receive untrusted input: validate types, not just values.
  if (typeof file.name !== "string" || typeof file.size !== "number" || !Number.isSafeInteger(file.size)) {
    return { ok: false, error: "Invalid file." };
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  // hasOwn, not `in`: `"constructor" in TYPES` is true via the prototype chain.
  if (!Object.hasOwn(TYPES, ext)) {
    return { ok: false, error: "Only WAV or MP3 files can be uploaded." };
  }
  if (file.size <= 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(file.size / 1024 / 1024);
    return { ok: false, error: `That file is ${mb} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  }
  const key = ext as keyof typeof TYPES;
  return { ok: true, contentType: TYPES[key], ext: key };
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
