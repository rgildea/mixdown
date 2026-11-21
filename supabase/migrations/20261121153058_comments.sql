-- Timestamped comments (ADR 0005, issue #46).
--
-- * Anyone who can access the song (a studio member, or a client whose grant's link is still active) can
--   read every comment on it and add their own. Revoking the link cuts a client off from comments too.
-- * at_ms is null for a comment on the whole mix (the commenter cleared the timestamp).
-- * No edits or deletes in v1: there are no UPDATE/DELETE policies or privileges.
-- * Deleting a user keeps their comments (author_user_id becomes null).
-- * author_name is display text the commenter chose (clients are anonymous, and an engineer's email must
--   never be shown to a client). author_user_id is always the caller.

-- A comment's version must belong to its song. The composite FK needs a unique key on both columns.
alter table public.mix_versions add constraint mix_versions_song_id_id_key unique (song_id, id);

create table public.comments (
  id             uuid primary key default gen_random_uuid(),
  song_id        uuid not null references public.songs (id) on delete cascade,
  version_id     uuid not null,
  at_ms          int check (at_ms between 0 and 24 * 60 * 60 * 1000),
  body           text not null check (char_length(btrim(body)) between 1 and 2000),
  -- Nullable so comments outlive their author's account: anonymous clients are throwaway users that a cleanup
  -- job may delete, and the engineer must keep their feedback (author_name still says who wrote it). Inserts
  -- always set it: the policy requires author_user_id = auth.uid().
  author_user_id uuid default auth.uid() references auth.users (id) on delete set null,
  author_name    text not null check (char_length(btrim(author_name)) between 1 and 80),
  created_at     timestamptz not null default now(),
  foreign key (song_id, version_id) references public.mix_versions (song_id, id) on delete cascade
);
-- The one query we run: a version's comments in timeline order.
create index comments_version_at_idx on public.comments (version_id, at_ms nulls first, created_at);
create index comments_song_idx on public.comments (song_id);
create index comments_author_idx on public.comments (author_user_id);

alter table public.comments enable row level security;
revoke all on public.comments from anon;

-- Writable columns only: id, author_user_id and created_at always take their defaults, so nobody can
-- post as someone else or backdate a comment.
revoke insert, update, delete, truncate on public.comments from authenticated;
grant insert (song_id, version_id, at_ms, body, author_name) on public.comments to authenticated;

-- Policies check the row's own song_id (never a lookup of comments by id), so insert ... returning works.
create policy "song members and active grantees read comments"
  on public.comments for select to authenticated
  using (private.can_access_song(song_id));

create policy "song members and active grantees comment as themselves"
  on public.comments for insert to authenticated
  with check (private.can_access_song(song_id) and author_user_id = (select auth.uid()));

comment on table public.comments is 'Comments pinned to a time (or the whole mix) on a mix version (ADR 0005, #46).';
comment on column public.comments.at_ms is 'Position in the mix in ms; null = a comment on the whole mix.';
