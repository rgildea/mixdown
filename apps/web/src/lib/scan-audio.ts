// Browser-only: measure a mix's duration and waveform peaks from the local file at upload (ADR 0010).
// Never throws and never blocks the upload: anything we can't scan returns null, and the mix is
// stored without a waveform (the page then shows the plain player).
import { MAX_DURATION_MS, PEAK_COUNT, type Waveform } from "./waveform-rules";

const CHUNK_BYTES = 4 * 1024 * 1024;
/**
 * decodeAudioData holds the whole file as float32 PCM, resampled to 44.1 kHz, in every channel: about
 * 21 MB per minute of stereo, whatever the MP3's bitrate. So the cap is on the decoded size, estimated
 * from the duration the browser reads from the MP3's metadata (assuming stereo): 300 MB is ~14 min.
 * Longer MP3s get no waveform rather than risk crashing the tab mid-upload. The byte cap is a backstop
 * (14 min at 320 kbps is ~33 MB). Server-side peaks would remove this limit (later issue).
 */
const MAX_DECODED_BYTES = 300 * 1024 * 1024;
const MAX_DECODE_BYTES = 40 * 1024 * 1024;
const DECODE_RATE = 44100;
/** Frames per slice of the decoded-MP3 peak loop, between yields (~1M samples, a few ms). */
const DECODED_SLICE_FRAMES = 1 << 19;

export async function scanAudio(file: File): Promise<Waveform | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const result = ext === "wav" ? await scanWav(file) : ext === "mp3" ? await scanDecoded(file) : null;
    if (!result || result.durationMs < 1 || result.durationMs > MAX_DURATION_MS) return null;
    return result;
  } catch (e) {
    console.warn("couldn't scan the mix for a waveform", e);
    return null;
  }
}

type WavFormat = { kind: "int" | "float"; bytes: number; channels: number; sampleRate: number; dataStart: number; dataBytes: number };

/** Walks the RIFF chunks (fmt may be preceded by bext/LIST/JUNK chunks of any size) to find fmt and data. */
async function readWavFormat(file: Blob): Promise<WavFormat | null> {
  const read = async (start: number, length: number) =>
    new DataView(await file.slice(start, start + length).arrayBuffer());
  const tag = (v: DataView, at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));

  const riff = await read(0, 12);
  if (riff.byteLength < 12 || tag(riff, 0) !== "RIFF" || tag(riff, 8) !== "WAVE") return null;

  let fmt: Omit<WavFormat, "dataStart" | "dataBytes"> | null = null;
  for (let at = 12; at + 8 <= file.size; ) {
    const head = await read(at, 8);
    const id = tag(head, 0);
    const size = head.getUint32(4, true);
    const body = at + 8;
    if (id === "fmt ") {
      const f = await read(body, Math.min(size, 40));
      if (f.byteLength < 16) return null;
      let code = f.getUint16(0, true);
      const channels = f.getUint16(2, true);
      const sampleRate = f.getUint32(4, true);
      const blockAlign = f.getUint16(12, true);
      const bits = f.getUint16(14, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format code is the first 2 bytes of the SubFormat GUID.
      if (code === 0xfffe && f.byteLength >= 26) code = f.getUint16(24, true);
      const kind = code === 1 ? "int" : code === 3 ? "float" : null;
      const bytes = bits / 8;
      const ok =
        kind !== null &&
        channels >= 1 &&
        sampleRate > 0 &&
        blockAlign === channels * bytes &&
        (kind === "int" ? [1, 2, 3, 4].includes(bytes) : [4, 8].includes(bytes));
      if (!ok) return null; // e.g. compressed (ADPCM) WAVs, or 12-bit samples padded oddly
      fmt = { kind, bytes, channels, sampleRate };
    } else if (id === "data") {
      if (!fmt) return null;
      // Streamed WAVs may record 0 or 0xFFFFFFFF as the size; trust the file length then.
      const available = file.size - body;
      const dataBytes = size === 0 || size > available ? available : size;
      return { ...fmt, dataStart: body, dataBytes: dataBytes - (dataBytes % (fmt.channels * fmt.bytes)) };
    }
    at = body + size + (size % 2); // chunks are padded to an even length
  }
  return null;
}

/** Reads the samples in 4 MB slices, yielding between them, so a 500 MB file never freezes the tab. */
async function scanWav(file: File): Promise<Waveform | null> {
  const fmt = await readWavFormat(file);
  if (!fmt) return null;
  const frameBytes = fmt.channels * fmt.bytes;
  const frames = fmt.dataBytes / frameBytes;
  if (frames < 1) return null;

  const buckets = Math.min(PEAK_COUNT, frames);
  const peaks = new Float32Array(buckets);
  const chunk = CHUNK_BYTES - (CHUNK_BYTES % frameBytes);
  const end = fmt.dataStart + fmt.dataBytes;
  let frame = 0;

  for (let at = fmt.dataStart; at < end; at += chunk) {
    const buf = await file.slice(at, Math.min(at + chunk, end)).arrayBuffer();
    const samples = toSamples(buf, fmt);
    const n = samples.length;
    for (let i = 0; i < n; i += fmt.channels, frame++) {
      let max = 0;
      for (let c = 0; c < fmt.channels; c++) {
        const v = Math.abs(samples.get(i + c));
        if (v > max) max = v;
      }
      const b = Math.floor((frame * buckets) / frames);
      if (max > peaks[b]) peaks[b] = max;
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  return { durationMs: Math.round((frames / fmt.sampleRate) * 1000), peaks: finish(peaks) };
}

/** Normalized (-1…1) sample reader over one chunk. Chunks are fresh ArrayBuffers, so typed arrays align. */
function toSamples(buf: ArrayBuffer, fmt: WavFormat): { length: number; get(i: number): number } {
  if (fmt.kind === "float") {
    const a = fmt.bytes === 4 ? new Float32Array(buf) : new Float64Array(buf);
    return { length: a.length, get: (i) => a[i] };
  }
  switch (fmt.bytes) {
    case 1: {
      const a = new Uint8Array(buf); // 8-bit WAV is unsigned
      return { length: a.length, get: (i) => (a[i] - 128) / 128 };
    }
    case 2: {
      const a = new Int16Array(buf);
      return { length: a.length, get: (i) => a[i] / 32768 };
    }
    case 3: {
      const a = new Uint8Array(buf);
      return {
        length: a.length / 3,
        get: (i) => {
          const o = i * 3;
          return ((a[o] | (a[o + 1] << 8) | (a[o + 2] << 16)) << 8 >> 8) / 8388608; // sign-extend 24 bits
        },
      };
    }
    default: {
      const a = new Int32Array(buf);
      return { length: a.length, get: (i) => a[i] / 2147483648 };
    }
  }
}

/** MP3: let the browser decode it (MP3s are ~10x smaller than WAVs of the same length). */
async function scanDecoded(file: File): Promise<Waveform | null> {
  if (file.size > MAX_DECODE_BYTES) return null;
  const seconds = await metadataDuration(file);
  if (seconds === null || seconds * DECODE_RATE * 2 * 4 > MAX_DECODED_BYTES) return null;
  const ctx = new OfflineAudioContext(1, 1, DECODE_RATE);
  const audio = await ctx.decodeAudioData(await file.arrayBuffer());
  const frames = audio.length;
  if (frames < 1) return null;
  const buckets = Math.min(PEAK_COUNT, frames);
  const peaks = new Float32Array(buckets);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c));
  for (let start = 0; start < frames; start += DECODED_SLICE_FRAMES) {
    const end = Math.min(start + DECODED_SLICE_FRAMES, frames);
    for (const data of channels) {
      for (let i = start; i < end; i++) {
        const v = Math.abs(data[i]);
        const b = Math.floor((i * buckets) / frames);
        if (v > peaks[b]) peaks[b] = v;
      }
    }
    await new Promise((r) => setTimeout(r, 0)); // same as scanWav: never freeze the tab
  }
  return { durationMs: Math.round(audio.duration * 1000), peaks: finish(peaks) };
}

/** The duration an audio element reads from the file's headers, without decoding it. Null if unknown. */
function metadataDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value: number | null) => {
      clearTimeout(timer);
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 5000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

/** Clamp (float WAVs and decoders can exceed 1.0 when clipping) and round to 3 decimals. */
function finish(peaks: Float32Array): number[] {
  return Array.from(peaks, (p) => Math.round(Math.min(1, p) * 1000) / 1000);
}
