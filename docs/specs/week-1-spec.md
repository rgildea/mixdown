# Mix Review Portal — Week 1 Spec: Foundation

Owner: Ryan Gildea
Time budget: 8–10 hours, split into five sessions
Week goal: a live website where I can log in, upload a mix, and play it back.

---

## 1. Why this week matters

Week 1 is plumbing only: accounts, storage, a database, and deployment. Nobody sees it but me. The danger is polishing it. The rule: if it works and it's deployed, it's done. Anything nicer goes on the Later list.

## 2. Definition of done

Week 1 is done when all of these are true on the **live URL**, not just on my laptop:

- [ ] I can sign in with a magic link sent to my email, and sign out.
- [ ] Signed-out visitors can't see any song pages. They get sent to the login page.
- [ ] I can create a song with a title and an optional client/artist name.
- [ ] I can upload a WAV or MP3 for that song and watch a progress bar while it uploads.
- [ ] After uploading, the song page plays the mix in the browser.
- [ ] The song list shows my songs, newest first.
- [ ] Every push to `main` deploys automatically.
- [ ] The README says what the project is and how to run it locally.

## 3. Scope

### In scope

- Login and logout with magic links, for me (the engineer) only
- Creating and listing songs
- Uploading one mix file per song (version 1)
- Playing the mix with the browser's built-in audio player
- Hosting, automatic deploys, and environment variables

### Out of scope (goes on the Later list)

| Item | Planned for |
|---|---|
| Waveform display | Week 2 |
| Client share links, timestamped comments | Week 2 |
| Uploading v2, v3… and comparing versions | Week 3 |
| Email notifications | Week 3 |
| AI revision notes | Week 5 |
| Tests and a CI pipeline beyond the deploy build | Week 6 |
| Payments, invoicing, branding, custom domain, dark mode, mobile app, team accounts, AIFF/FLAC support, editing or deleting songs | Later list |

## 4. Tech stack (decided, no further debate)

| Layer | Choice | Why |
|---|---|---|
| App framework | Next.js (App Router) + TypeScript | One codebase for frontend and backend; widely used; fast to deploy |
| Styling | Tailwind CSS | Quick, consistent styling without design work |
| Login, database, storage | Supabase (Auth, Postgres, Storage) | All three in one managed service; free to start |
| Large file uploads | `tus-js-client`, uploading straight from the browser to Supabase Storage | Supabase recommends resumable (TUS) uploads for files over 6 MB, and this method reports upload progress ([Supabase](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)) |
| Hosting | Vercel, connected to GitHub | Every push deploys automatically |
| AI coding tool | Claude Code or Cursor | I write the specs and review every change; the AI writes most of the routine code |

### File size decision (important)

- The Supabase Free plan caps each uploaded file at **50 MB**. The Pro plan ($25/month) allows files up to 500 GB ([Supabase pricing](https://supabase.com/pricing)). A 5-minute 24-bit/48 kHz stereo WAV is about 85 MB.
- **Week 1:** stay on the Free plan. Limit uploads to 50 MB and test with MP3s or short WAVs.
- **Before Week 4 (first real client):** upgrade to Pro, then raise the global and bucket file size limits. Both are set in Storage settings ([Supabase](https://supabase.com/docs/guides/storage/uploads/file-limits)).
- Free projects also pause after a week of inactivity, and include 1 GB of storage and 5 GB of downloads (egress) ([Supabase pricing](https://supabase.com/pricing)). That's fine for Week 1, but it's another reason to upgrade before real use.
- **Never send the audio file through my own server.** Vercel caps request bodies at about 4.5 MB ([Files SDK guide](https://files-sdk.dev/guides/supabase-private-uploads-rls)), so files go straight from the browser to Supabase Storage.

## 5. Data model

Each user owns their own data, enforced in the database with Supabase's Row Level Security (RLS). Week 1 has only one user (me), but this keeps it safe later.

```sql
-- songs: one row per song I'm mixing
create table songs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  client_name  text,
  created_at   timestamptz not null default now()
);

-- mix_versions: Week 1 only creates version 1, but the table is ready for Week 3
create table mix_versions (
  id                uuid primary key default gen_random_uuid(),
  song_id           uuid not null references songs(id) on delete cascade,
  version_number    int  not null default 1,
  storage_path      text not null,   -- e.g. {owner_id}/{song_id}/v1-{filename}
  original_filename text not null,
  mime_type         text not null,
  size_bytes        bigint not null,
  created_at        timestamptz not null default now(),
  unique (song_id, version_number)
);

alter table songs enable row level security;
alter table mix_versions enable row level security;

create policy "owner can do everything with own songs"
  on songs for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner can do everything with own versions"
  on mix_versions for all
  using (exists (select 1 from songs s where s.id = song_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from songs s where s.id = song_id and s.owner_id = auth.uid()));
```

**Storage bucket:** `mixes`, **private**, allowed types `audio/wav`, `audio/x-wav`, `audio/mpeg`, file size limit 50 MB for now. Storage policies let a signed-in user read and write only paths that start with their own user ID.

**Playback:** the song page asks Supabase for a short-lived signed URL (1 hour) for the file and gives it to the `<audio>` element. The bucket is never public.

## 6. Pages

| Route | Who | What it does |
|---|---|---|
| `/login` | Anyone | Email field and "Send magic link" button |
| `/auth/callback` | Anyone | Finishes the magic-link login, then redirects to `/songs` |
| `/songs` | Signed in | Song list (title, client, date), newest first, plus a "New song" button |
| `/songs/new` | Signed in | Title, optional client name, file picker, upload progress bar |
| `/songs/[id]` | Signed in (owner) | Title, client, file name and size, audio player |

Middleware sends signed-out visitors from any `/songs` route to `/login`.

## 7. Upload flow

1. I fill in the title and pick a file. The browser checks the file type (WAV or MP3) and size (50 MB or less) and shows a clear error if it fails.
2. The app creates the `songs` row.
3. The browser uploads the file to `mixes/{owner_id}/{song_id}/v1-{safe-filename}` with TUS, showing a progress bar.
4. When the upload succeeds, the app creates the `mix_versions` row (version 1).
5. The app redirects to `/songs/[id]`.
6. **If the upload fails,** the app shows the error with a "Try again" button. If I give up, the song simply has no mix yet, and its page says "No mix uploaded."

## 8. Sessions

| # | Time | Task | Done when |
|---|---|---|---|
| 1 | ~2 h | Create the GitHub repo, the Next.js + TypeScript + Tailwind app, and a Supabase project; connect Vercel; set environment variables | A "Hello" page is live at the Vercel URL |
| 2 | ~2 h | Magic-link login, logout, auth callback, protected routes | Signing in and out works on the live site |
| 3 | ~2 h | Database migrations (tables + RLS), song list and the create-song form (no file yet) | Songs I create show up in my list on the live site |
| 4 | ~2–3 h | Private storage bucket and policies, TUS upload with progress bar, creating the `mix_versions` row | A WAV uploads with a working progress bar |
| 5 | ~1–2 h | Song page with signed-URL playback, error states, README, full run-through of the definition of done | Every box in section 2 is checked on the live URL |

If a session runs over by more than an hour, stop and cut scope rather than pushing through. Write it down in the weekly notes.

## 9. Manual test checklist (run on the live site)

- [ ] Upload a 3–5 MB MP3. It plays.
- [ ] Upload a WAV under 50 MB. It plays, and the progress bar moves smoothly.
- [ ] Try a 60 MB file. You get a clear error before the upload starts.
- [ ] Try a .txt or .aiff file. You get a clear error.
- [ ] Sign out, then paste a song URL. You get sent to login.
- [ ] Sign in from a second browser with a different email. You can't see the first account's songs.
- [ ] Refresh the song page after an hour. Playback still works, because the page requests a fresh signed URL.

## 10. Rules for working with the AI coding tool

- Start each session by giving the AI this spec plus `PROJECT.md` (below), and tell it which session you're on.
- Ask for small steps: one feature, then review the diff, run it, and commit.
- If the AI suggests anything in the Out of scope list, say no and add it to the Later list.
- Make the architecture calls yourself: data model, security policies, upload approach. Let the AI handle setup code, forms, and styling.
- Keep a short log in `NOTES.md`: what I asked the AI, what it got wrong, and what I decided. This becomes the interview story and the Week 6 write-up.

## 11. `PROJECT.md` starter (keep in the repo root)

```markdown
# Mix Review Portal

## What it is
A web app where an audio engineer shares mixes with clients, who leave
timestamped comments and approve versions.

## Current phase
Week 1: foundation (login, songs, upload, playback). See week-1-spec.md.

## Stack
Next.js App Router + TypeScript, Tailwind, Supabase (Auth, Postgres, Storage),
tus-js-client for uploads, Vercel hosting.

## Conventions
- Server components by default; client components only for interactivity.
- All data access goes through Supabase with RLS. Never use the service-role
  key in the browser.
- Audio files upload directly from the browser to Storage. Never send them
  through a Next.js route.
- Keep it simple: no state libraries, no ORMs, no component libraries in Week 1.

## Later list
(waveform, share links, comments, versions, notifications, AI notes, payments, …)
```

## 12. Opening prompt for Session 1

> I'm building a mix review portal. Read PROJECT.md and week-1-spec.md. We're on Session 1 only: set up a Next.js App Router + TypeScript + Tailwind project, add the Supabase client libraries and environment variable placeholders, and create a simple home page. Don't build login or database tables yet. List the commands to run and the files you'll create before writing anything.

## 13. End-of-week check-in

Answer in `NOTES.md`:

1. What shipped? (Link to the live URL.)
2. What did I cut or move to the Later list?
3. What slowed me down?
4. What's the single goal for Week 2? (Client share link + waveform + timestamped comments.)
