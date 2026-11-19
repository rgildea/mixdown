# 0003. Browser → Supabase Storage via TUS; private bucket + signed URLs

- Status: Accepted
- Date: 2026-11-19

## Context
Mixes are 10–150 MB WAVs. Vercel functions cap request bodies at ~4.5 MB, and proxying
large files through our server costs money and time. Unreleased client music must not
be publicly reachable.

## Decision
- The browser uploads **directly** to Supabase Storage using **tus-js-client** (resumable,
  reports progress) to `/storage/v1/upload/resumable`, authenticated with the user's
  session access token.
- Bucket `mixes` is **private**. Object path: `{owner_id}/{song_id}/v{n}-{safe-filename}`.
  Storage policies allow a signed-in user to read/write only under their own `owner_id/` prefix.
- Allowed MIME types: `audio/wav`, `audio/x-wav`, `audio/mpeg`. Size limit 50 MB (Free plan),
  checked client-side first for a clear error, and enforced by the bucket.
- Playback uses a **signed URL (1 hour)** created server-side on each page load; `<audio>`
  streams it with HTTP range requests.
- Upload order: create `songs` row → upload file → insert `mix_versions` row. A failed upload
  leaves a song with no version ("No mix uploaded"), which is acceptable.

## Alternatives considered
- Signed upload URL + single PUT: simpler, but no resume and coarser progress for big WAVs.
- Upload through a Next.js route: blocked by the body limit.
- Public bucket with unguessable paths: leaks unreleased music if a URL is shared.

## Consequences
- Orphaned objects are possible if the row insert fails after upload. Acceptable in v1; a
  cleanup job goes on the Later list.
- Week 2 waveform: decode peaks in the browser once and store them (JSON) to avoid
  re-downloading full WAVs. Separate ADR then.
- Before Week 4: Pro plan, raise global + bucket size limits (e.g. 500 MB).
