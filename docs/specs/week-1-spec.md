# Mix Review Portal: Week 1 Spec (Foundation)

Owner: Ryan Gildea
Time budget: 8–10 hours, split into five sessions
Week goal: a live website where I can log in, upload a mix, and play it back.

> **Revised 2026-11-19 after the ADR review** (`docs/adr/`). Changes from the original draft:
> audio lives in **Cloudflare R2** via presigned URLs instead of Supabase Storage + TUS (ADR 0002/0003);
> data is owned by **workspaces** (ADR 0004); **signups are invite-only**; max upload is **500 MB**;
> Next.js 16 uses **`proxy.ts`** instead of middleware. Task-level detail lives in the Week 1 GitHub issues.

---

## 1. Why this week matters

Week 1 is plumbing only: accounts, storage, a database, and deployment. Nobody sees it but me. The danger is polishing it. The rule: if it works and it's deployed, it's done. Anything nicer goes on the Later list.

## 2. Definition of done

Week 1 is done when all of these are true on the **live URL**, not just on my laptop:

- [ ] I can sign in with a magic link sent to my email, and sign out. Uninvited emails can't sign in.
- [ ] Signed-out visitors can't see any song pages. They get sent to the login page.
- [ ] I can create a song with a title and an optional client/artist name.
- [ ] I can upload a WAV or MP3 (up to 500 MB) for that song and watch a progress bar while it uploads.
- [ ] After uploading, the song page plays the mix in the browser.
- [ ] The song list shows my workspace's songs, newest first.
- [ ] Every push to `main` deploys automatically.
- [ ] The README says what the project is and how to run it locally.

## 3. Scope

### In scope

- Login and logout with magic links, invite-only (me plus a test account)
- An automatic personal workspace per user
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
| Paid plans (Vercel Pro, Supabase Pro) and a separate prod environment | Before Week 4 |
| AI revision notes | Week 5 |
| Tests and a CI pipeline beyond the deploy build | Week 6 |
| Inviting workspace members, roles UI, workspace switcher | Later list |
| Resumable/multipart uploads, compressed streaming copies | Later list |
| Payments, invoicing, branding, custom domain, dark mode, mobile app, AIFF/FLAC support, editing or deleting songs | Later list |

## 4. Tech stack (decided; see ADR 0002)

| Layer | Choice | Why |
|---|---|---|
| App framework | Next.js 16 (App Router) + TypeScript | One codebase for frontend and backend; most in demand; best AI-tool support |
| Styling | Tailwind CSS v4 | Quick, consistent styling without design work |
| Login + database | Supabase (Auth, Postgres with RLS) | Managed auth with `auth.uid()` in database policies |
| Audio storage | Cloudflare R2, presigned URLs | Zero egress fees for streaming large files; S3 API |
| Hosting | Vercel (Hobby now, Pro before Week 4) | Every push deploys; preview per PR |
| AI coding tool | Claude Code or Cursor (rules in `AGENTS.md`) | I write the specs and review every change |

### File size and cost notes

- Max upload **500 MB** (constant `MAX_UPLOAD_BYTES`). R2 single PUT allows up to 5 GB. A 6-minute 24-bit/96 kHz stereo WAV is about 200 MB.
- **Never send the audio file through my own server.** Vercel caps request bodies at about 4.5 MB, so files go straight from the browser to R2 with a presigned URL.
- Supabase Free projects pause after a week of inactivity; Vercel Hobby is non-commercial. Both get upgraded before Week 4.

## 5. Data model (ADR 0004)

```sql
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'owner' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table songs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_by   uuid not null default auth.uid() references auth.users(id),
  title        text not null check (char_length(title) between 1 and 200),
  client_name  text,
  created_at   timestamptz not null default now()
);

-- Week 1 only creates version 1, but the table is ready for Week 3
create table mix_versions (
  id                uuid primary key default gen_random_uuid(),
  song_id           uuid not null references songs(id) on delete cascade,
  version_number    int  not null default 1,
  object_key        text not null,   -- {workspace_id}/{song_id}/v1-{uuid}.{ext}
  original_filename text not null,
  mime_type         text not null,
  size_bytes        bigint not null,
  created_by        uuid not null default auth.uid() references auth.users(id),
  created_at        timestamptz not null default now(),
  unique (song_id, version_number)
);
```

- RLS on all four tables. Policies use one helper, `private.is_member(workspace_id)`
  (`security definer`, `stable`, `search_path` set, in a non-exposed `private` schema).
- A trigger on `auth.users` insert creates a personal workspace with that user as `owner`.
- Indexes: `songs(workspace_id, created_at desc)`, `mix_versions(song_id)`, `workspace_members(user_id)`.

**R2 bucket:** `mixdown-dev`, private, CORS from `infra/r2-cors.json`. No public access.

**Playback:** the song page checks access via RLS, then creates a presigned GET URL (1 hour) for the `<audio>` element.

## 6. Pages

| Route | Who | What it does |
|---|---|---|
| `/login` | Anyone | Email field and "Send magic link" button (`shouldCreateUser: false`) |
| `/auth/callback` | Anyone | Finishes the magic-link login, then redirects to `/songs` |
| `/songs` | Signed in | Workspace's song list (title, client, date), newest first, plus a "New song" button |
| `/songs/new` | Signed in | Title, optional client name, file picker, upload progress bar |
| `/songs/[id]` | Workspace member | Title, client, file name and size, audio player |

`src/proxy.ts` refreshes the session and sends signed-out visitors from any `/songs` route to `/login`.

## 7. Upload flow (ADR 0003)

1. I fill in the title and pick a file. The browser checks the type (WAV or MP3) and size (≤ 500 MB) and shows a clear error if it fails.
2. A Server Action creates the `songs` row in my workspace.
3. Server Action `createUploadUrl` re-checks type/size and access (via RLS), and returns a presigned PUT URL (15 min) with content type and length signed.
4. The browser PUTs the file to R2 with XHR, showing a progress bar.
5. Server Action `finishUpload` confirms the object exists in R2 with the right size, then creates the `mix_versions` row (version 1).
6. The app redirects to `/songs/[id]`.
7. **If the upload fails,** the app shows the error with a "Try again" button. If I give up, the song simply has no mix yet, and its page says "No mix uploaded."

## 8. Sessions

| # | Time | Task | Done when |
|---|---|---|---|
| 1 | ~2 h | Supabase project, R2 bucket + token + CORS, connect Vercel, env vars (repo + scaffold already done) | A "Hello" page is live at the Vercel URL |
| 2 | ~2 h | Invite-only magic-link login, logout, auth callback, `proxy.ts` protected routes | Signing in and out works on the live site |
| 3 | ~2 h | Migrations (workspaces, members, trigger, songs, mix_versions, RLS), song list and create-song form (no file yet) | Songs I create show up in my list on the live site |
| 4 | ~2–3 h | `src/lib/r2.ts`, presigned PUT upload with progress bar, `finishUpload` + `mix_versions` row | A WAV uploads with a working progress bar |
| 5 | ~1–2 h | Song page with presigned-GET playback, error states, README, full run-through of the definition of done | Every box in section 2 is checked on the live URL |

If a session runs over by more than an hour, stop and cut scope rather than pushing through. Write it down in the weekly notes.

## 9. Manual test checklist (run on the live site)

- [ ] Upload a 3–5 MB MP3. It plays.
- [ ] Upload a 100–300 MB WAV. It plays, and the progress bar moves smoothly.
- [ ] Try a 600 MB file. You get a clear error before the upload starts.
- [ ] Try a .txt or .aiff file. You get a clear error.
- [ ] Sign out, then paste a song URL. You get sent to login.
- [ ] Try to sign in with an uninvited email. No account is created.
- [ ] Sign in from a second browser with a second invited account. You can't see the first account's songs.
- [ ] Copy the audio URL, wait an hour: it stops working. Refresh the page: playback works again.

## 10. Rules for working with the AI coding tool

- Start each session from its GitHub issue. The AI reads `AGENTS.md`, `PROJECT.md` and this spec.
- Ask for small steps: one feature, then review the diff, run it, and commit.
- If the AI suggests anything in the Out of scope list, say no and open a `later` issue.
- Make the architecture calls yourself: data model, security policies, upload approach. Let the AI handle setup code, forms, and styling.
- Keep a short log in `NOTES.md`: what I asked the AI, what it got wrong, and what I decided.

## 11. Opening prompt for each session

> We're on Week 1, Session N: issue #X. Read the issue, `docs/specs/week-1-spec.md`, and the ADRs it
> references. List the files you'll create or change and the commands you'll run before writing anything.

## 12. End-of-week check-in

Answer in `NOTES.md`:

1. What shipped? (Link to the live URL.)
2. What did I cut or move to the Later list?
3. What slowed me down?
4. What's the single goal for Week 2? (Client share link + waveform + timestamped comments.)
