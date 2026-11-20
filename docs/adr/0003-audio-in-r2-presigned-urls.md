# 0003. Audio in Cloudflare R2 via presigned URLs; ownership checked in Supabase

- Status: Accepted
- Date: 2026-11-19
- Decided by: Ryan (reviewed; replaces an AI-drafted Supabase Storage + TUS design)

## Context
Mixes are 10–500 MB WAV/MP3 files. Unreleased client music must never be publicly reachable.
Vercel functions cap request bodies at ~4.5 MB, so files can't pass through our server.
ADR 0002 puts audio in R2 (zero egress fees) and authorization in Supabase.

## Decision
**Supabase decides who may touch a file; R2 only stores bytes; the browser talks to R2 directly.**

Upload:
1. Browser validates type (`audio/wav`, `audio/x-wav`, `audio/mpeg`) and size (≤ **500 MB**,
   one constant `MAX_UPLOAD_BYTES`), then a Server Action creates the `songs` row.
2. Server Action `createUploadUrl({ songId, filename, size })`: confirms the user, re-checks
   type/size (type decided by file extension, stored as one canonical MIME type), loads the song
   through RLS **and requires it to be in the user's own workspace** (read access alone isn't
   enough once share links exist), and returns a **presigned PUT URL** (15 min) with
   `Content-Type` and `Content-Length` signed in (`signableHeaders`), so storage rejects anything else.
3. Browser uploads with a **single PUT via XHR** (for `upload.onprogress`), and shows a progress bar.
4. Server Action `finishUpload({ songId, key, filename, size })`: accepts only a key this song could
   have been issued, `HeadObject` to confirm the object exists with the expected size and type, then
   inserts `mix_versions` (version 1). The DB never points at a missing file. A duplicate insert
   (a retried finish) counts as success.

Playback: the song page (Server Component) checks ownership via RLS and generates a **presigned
GET URL (1 h)** on each request. `<audio>` streams it with range requests.

Details:
- Bucket: private, no public dev URL. CORS allows `PUT`/`GET`/`HEAD` from our origins
  (localhost, production, Vercel previews). CORS is not the security layer; signatures are.
- Object key: `{workspace_id}/{song_id}/v{n}-{uuid}.{ext}`. Original filename lives only in the DB.
- Library: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, endpoint
  `https://<account_id>.r2.cloudflarestorage.com`.
- Credentials: an R2 API token scoped to this bucket (Object Read & Write). Env vars
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Only read
  in `src/lib/r2.ts`, which imports `server-only`.

## Alternatives considered
- **Supabase Storage + TUS resumable uploads** (original draft): storage policies in SQL are
  elegant, but egress pricing and a 50 MB Free cap. Rejected in ADR 0002.
- **S3 multipart with presigned parts:** resumable and parallel, about 3× the code. Revisit only if
  real uploads fail on large files or poor connections; the create → upload → finish flow stays the same.
- **Upload through a Next.js route:** blocked by the body limit, and doubles bandwidth.
- **Public bucket with unguessable keys:** leaks unreleased music if a URL is forwarded.

## Consequences
- A failed upload leaves a song with no version ("No mix uploaded"), which is fine. An upload whose
  `finishUpload` never runs leaves an orphaned object; cleanup goes on the Later list.
- A dropped connection restarts the upload from zero (single PUT).
- Week 2 client share pages reuse the same presigned-GET path after validating a share token.
- Later list: a compressed streaming copy (AAC/MP3) for faster client playback; stored waveform peaks (Week 2 ADR).

## Changelog
| Date | Change | Why |
|---|---|---|
| 2026-11-19 | Drafted by AI: Supabase Storage + TUS resumable uploads, 50 MB cap. | Followed the original stack. |
| 2026-11-19 | Rewritten for R2: presigned PUT/GET, server checks ownership, single PUT, 500 MB limit (`52e185f`). | Follows the R2 decision in 0002. Multipart deferred until real uploads fail. |
| 2026-11-19 | Amended after the PR #34 review: type decided by extension; **Content-Type signed** (`signableHeaders`); upload requires the song in the user's *own* workspace; a duplicate finish counts as success; key prefix `{workspace_id}` (PR #34). | A probe showed the SDK signs only Content-Length by default. The independent review found that read access was being treated as upload permission. |
