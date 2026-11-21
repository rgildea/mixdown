# 0010. Waveform peaks and duration computed in the browser at upload, stored on the mix version

- Status: Proposed
- Date: 2026-11-21
- Decided by: (awaiting Ryan)

## Context
Week 2 needs a waveform on the song page and on the client's listen page (#45), and Week 2 S5 pins
comments to timestamps on it (#46). Mixes are WAV or MP3 up to **500 MB** (ADR 0003); a 24-bit stereo
48 kHz WAV of 300 MB is about 18 minutes. Clients often open the link on a phone.

A waveform needs two things: **peaks** (one loudness value per slice of the song) and the **duration**.
The #3 review of the old repos also asked us to store each mix's duration, so comment timestamps can be
validated against it and the player can show the length before audio loads.

wavesurfer.js (the plan's choice, used by the old repos) draws from given peaks + duration and plays
through an existing `<audio>` element. With both supplied, it doesn't fetch or decode the file at all
(checked in the v8.1 source: `load()` skips the fetch when peaks are passed), so playback keeps
streaming from the presigned GET URL with range requests, exactly as today.

## Decision
**The engineer's browser computes peaks and duration from the local file while it uploads, and
`finishUpload` stores them on the `mix_versions` row. Pages hand them to wavesurfer.js with the
existing signed `<audio>` URL. Nobody downloads or decodes the whole file to see a waveform.**

Details:
- **WAV:** read the header (PCM 16/24/32-bit integer, 32-bit float, and `WAVE_FORMAT_EXTENSIBLE`
  wrapping those), then scan the samples in 4 MB `File.slice()` chunks, yielding between chunks. No
  `decodeAudioData`, constant memory. Duration comes from the header (data bytes ÷ byte rate), so
  it's exact. Spike: a 300 MB 24-bit stereo WAV took **2.1 s** in Chromium, each chunk ~30 ms
  (under the 50 ms "long task" line), so the tab stays responsive during the upload.
- **MP3:** `decodeAudioData` on the file (MP3s are ~10× smaller than WAVs of the same length; a
  10 MB MP3 decodes in well under a second). Duration from the decoded buffer.
- **Peaks format:** **2,000 values**, one channel (the louder of L/R in each slice), each 0–1,
  rounded to 3 decimals. Enough for a page up to ~1,000 px wide at 2× density; zooming is not in v1.
- **Schema (new migration):** `mix_versions.duration_ms int` (1 ms … 24 h) and
  `mix_versions.peaks real[]` (1–4,000 values, each between 0 and 1), both **nullable**, enforced by
  `CHECK` constraints. About 8 KB per version. Same RLS as the row: anyone who may read the mix version
  (members, active grantees) may read its waveform; only members write it, only at insert.
- **Server Action:** `finishUpload` takes optional `durationMs` and `peaks`, validates type, range and
  length (untrusted input, as for every argument), and inserts them with the row.
- **Missing peaks** (rows uploaded before this change, or a WAV variant we can't parse, e.g. 8-bit or
  compressed WAV): the upload still succeeds with nulls, and the page shows the plain `<audio>` player
  as today. No "decode it in the browser" fallback, because that downloads the whole file first.
- **Player:** `wavesurfer.js` 8.1 (BSD-3), one shared Client Component used by both pages, created with
  `media: <the audio element>`, `peaks`, `duration`, click and drag to seek. The `<audio controls>` stays
  as the keyboard- and screen-reader-accessible control.

## Alternatives considered
- **Decode in the browser on every view** (cut-list fallback in #9): the viewer downloads all 300 MB
  before the waveform appears, and decoded 18 min stereo float audio is ~400 MB of RAM, enough to kill a
  phone tab. Fine for 5 MB MP3s, wrong for the files engineers actually send.
- **Compute on a server** (Vercel function, or a queue worker after upload): a function would have to
  download up to 500 MB and ship an audio decoder within its time and memory limits, and a worker is the
  upload "post-processor" the old repos built and never finished (lessons #3). More moving parts, for
  the same numbers the engineer's browser can produce in 2 s from a file it already has.
- **Peaks as a JSON object in R2 next to the audio:** another key, another signed URL and fetch per
  view, and it can drift from the DB row. In Postgres it's one column, covered by the existing RLS and
  written atomically with the row.

## Consequences
- The waveform appears with the page; audio still streams on demand. Works the same on the share page.
- Peaks and duration are **supplied by the engineer's browser**, so a member could store wrong values.
  That only misdraws their own studio's song; the DB constraints bound the size and range. Comment
  timestamps (#46) are validated against `duration_ms`.
- Existing dev/test uploads have no waveform until re-uploaded (no backfill: nothing in production yet).
- Week 3 versions reuse the same upload step, so every new version gets peaks for free.
- Later, if needed: a Web Worker for the scan (only if the 30 ms chunks prove janky on slow laptops),
  more peak resolution for zoom, and RF64 for WAVs over 4 GB (above our 500 MB limit anyway).

## Changelog
| Date | Change | Why |
|---|---|---|
| 2026-11-21 | Created (Proposed). | #45 asks for an ADR before building the waveform. |
