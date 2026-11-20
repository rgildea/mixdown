-- Client share links (ADR 0005): share link → anonymous session → song_access grant → plain RLS.
--
-- * share_links: one ACTIVE link per song. The token is stored (Ryan's call: engineers can re-copy the
--   link later) and readable only by members of the song's studio.
-- * song_access: grants created ONLY by redeem_share_link(). A grant counts only while its link is
--   active, so revoking (or expiring) a link cuts off every client who used it.
-- * Reads of songs/mix_versions now allow members OR active grantees; writes stay members-only.

create table public.share_links (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null references public.songs (id) on delete cascade,
  token      text not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),  -- 192-bit base64url from the app
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,            -- unused in v1 (null = never)
  revoked_at timestamptz
);
create unique index share_links_one_active_per_song on public.share_links (song_id) where revoked_at is null;

create table public.song_access (
  song_id       uuid not null references public.songs (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  role          text not null default 'client' check (role = 'client'),
  created_at    timestamptz not null default now(),
  primary key (song_id, user_id)
);
create index song_access_user_idx on public.song_access (user_id);
create index song_access_link_idx on public.song_access (share_link_id);

alter table public.share_links enable row level security;
alter table public.song_access enable row level security;
revoke all on public.share_links, public.song_access from anon;

-- ---------------------------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER: they read across RLS without recursion; empty search_path).
-- ---------------------------------------------------------------------------------------------
create function private.is_song_member(sid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.songs s where s.id = sid and private.is_member(s.workspace_id));
$$;

-- The current user holds a grant for this song whose link is still active.
create function private.has_active_grant(sid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.song_access a
    join public.share_links l on l.id = a.share_link_id and l.song_id = a.song_id
    where a.song_id = sid
      and a.user_id = (select auth.uid())
      and l.revoked_at is null
      and (l.expires_at is null or l.expires_at > now())
  );
$$;

create function private.can_access_song(sid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_song_member(sid) or private.has_active_grant(sid);
$$;

revoke all on function private.is_song_member(uuid), private.has_active_grant(uuid), private.can_access_song(uuid) from public;
grant execute on function private.is_song_member(uuid), private.has_active_grant(uuid), private.can_access_song(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Reads: members OR active grantees. (Writes to songs/mix_versions are unchanged: members only.)
-- ---------------------------------------------------------------------------------------------
drop policy "members can read songs" on public.songs;
-- Uses the row's own workspace_id rather than looking the song up again: a lookup can't see a row
-- inserted in the same statement, which broke `insert ... returning` (createSong) in the first draft.
create policy "members and active grantees can read songs"
  on public.songs for select to authenticated
  using (private.is_member(workspace_id) or private.has_active_grant(id));

drop policy "members can read mix versions" on public.mix_versions;
create policy "members and active grantees can read mix versions"
  on public.mix_versions for select to authenticated
  using (private.can_access_song(song_id));

-- ---------------------------------------------------------------------------------------------
-- share_links: studio members only. Revoking = setting revoked_at (the only updatable column).
-- ---------------------------------------------------------------------------------------------
create policy "members can read their songs' links"
  on public.share_links for select to authenticated
  using (private.is_song_member(song_id));

create policy "members can create links as themselves"
  on public.share_links for insert to authenticated
  with check (private.is_song_member(song_id) and created_by = (select auth.uid()));

-- Revoking is final: revoked_at can be set but never cleared (un-revoking would revive the old token and
-- every grant tied to it). Found in the PR #52 review.
create policy "members can revoke their songs' links"
  on public.share_links for update to authenticated
  using (private.is_song_member(song_id))
  with check (private.is_song_member(song_id) and revoked_at is not null);

revoke update on public.share_links from authenticated;
grant update (revoked_at) on public.share_links to authenticated;

-- song_access: a user sees their own grants; members see grants on their songs. No direct writes.
create policy "users see own grants; members see grants on their songs"
  on public.song_access for select to authenticated
  using (user_id = (select auth.uid()) or private.is_song_member(song_id));

-- ---------------------------------------------------------------------------------------------
-- Redeem: the ONLY way grants are created. Returns the song id, or null for an invalid, revoked or
-- expired link. Requires a session (share pages sign visitors in anonymously first).
-- ---------------------------------------------------------------------------------------------
create function public.redeem_share_link(link_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := (select auth.uid());
  link public.share_links%rowtype;
begin
  if uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into link
  from public.share_links l
  where l.token = link_token
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now());
  if not found then
    return null;
  end if;

  -- Studio members already have access; don't create client grants for them.
  if not private.is_song_member(link.song_id) then
    insert into public.song_access (song_id, user_id, share_link_id)
    values (link.song_id, uid, link.id)
    on conflict (song_id, user_id) do update set share_link_id = excluded.share_link_id;
  end if;

  return link.song_id;
end;
$$;

revoke all on function public.redeem_share_link(text) from public, anon;
grant execute on function public.redeem_share_link(text) to authenticated;
