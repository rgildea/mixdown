// Waveform data rules shared by the browser (scanning at upload) and the server (finishUpload).
// ADR 0010. The database enforces the same bounds with CHECK constraints.

/** Peaks we compute per mix: enough for a ~1,000 px wide waveform at 2x density. */
export const PEAK_COUNT = 2000;
/** The most the server and database accept (headroom for a later resolution bump). */
export const MAX_PEAKS = 4000;
export const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

export type Waveform = { durationMs: number; peaks: number[] };

/**
 * Validates untrusted waveform input (Server Action arguments). Returns a clean copy, or null if
 * anything is off: the mix is then stored without a waveform rather than failing the upload.
 */
export function checkWaveform(input: unknown): Waveform | null {
  if (typeof input !== "object" || input === null) return null;
  const { durationMs, peaks } = input as Record<string, unknown>;
  if (!Number.isSafeInteger(durationMs) || (durationMs as number) < 1 || (durationMs as number) > MAX_DURATION_MS) {
    return null;
  }
  if (!Array.isArray(peaks) || peaks.length < 1 || peaks.length > MAX_PEAKS) return null;
  const clean: number[] = [];
  for (const p of peaks) {
    if (typeof p !== "number" || !(p >= 0 && p <= 1)) return null; // also rejects NaN
    // Same rounding as the scanner. Also maps values too small for Postgres `real` (e.g. 1e-50, which
    // raises "out of range") to 0, so a tampered value can't fail the insert.
    clean.push(Math.round(p * 1000) / 1000);
  }
  return { durationMs: durationMs as number, peaks: clean };
}

/** 3:05, 1:02:09. */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
