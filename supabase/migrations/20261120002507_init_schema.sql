-- Initial schema: workspaces own the data, users are members, RLS enforces membership.
-- Design: docs/adr/0004-workspace-ownership-and-rls.md. Week 1 spec §5.
--
-- Privileges are deliberately narrow for Week 1: members can read and create, not edit or delete
-- (editing/deleting songs is on the Later list). Add UPDATE/DELETE policies when those features land.

-- ---------------------------------------------------------------------------------------------
-- Private schema for helpers. Not exposed through the Data API (only `public` is), so these
-- functions can't be called directly by clients.
-- ---------------------------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  created_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.songs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by   uuid not null default auth.uid() references auth.users (id),
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  client_name  text check (client_name is null or char_length(client_name) <= 200),
  created_at   timestamptz not null default now()
);

create table public.mix_versions (
  id                uuid primary key default gen_random_uuid(),
  song_id           uuid not null references public.songs (id) on delete cascade,
  version_number    int not null default 1 check (version_number > 0),
  object_key        text not null unique,       -- R2 key: {workspace_id}/{song_id}/v{n}-{uuid}.{ext}
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type         text not null check (mime_type in ('audio/wav', 'audio/x-wav', 'audio/mpeg')),
  size_bytes        bigint not null check (size_bytes > 0),
  created_by        uuid not null default auth.uid() references auth.users (id),
  created_at        timestamptz not null default now(),
  unique (song_id, version_number)
);

-- Indexes for the queries we actually run. (mix_versions.song_id is covered by the unique index.)
create index songs_workspace_created_idx on public.songs (workspace_id, created_at desc);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------------------------
-- Membership helper used by every policy. SECURITY DEFINER so it can read workspace_members
-- without triggering that table's own RLS (avoids policy recursion). Empty search_path and
-- fully-qualified names prevent search_path hijacking.
-- ---------------------------------------------------------------------------------------------
create function private.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_member(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.songs             enable row level security;
alter table public.mix_versions      enable row level security;

-- Signed-out (anon) clients never touch these tables. RLS would already return nothing; revoking
-- the table privileges makes it an error instead, as defense in depth.
revoke all on public.workspaces, public.workspace_members, public.songs, public.mix_versions from anon;

-- Workspaces and memberships are read-only for users in v1 (created by the trigger below;
-- inviting members is on the Later list).
create policy "members can read their workspaces"
  on public.workspaces for select to authenticated
  using (private.is_member(id));

create policy "members can read their workspace's memberships"
  on public.workspace_members for select to authenticated
  using (private.is_member(workspace_id));

create policy "members can read songs"
  on public.songs for select to authenticated
  using (private.is_member(workspace_id));

create policy "members can create songs as themselves"
  on public.songs for insert to authenticated
  with check (private.is_member(workspace_id) and created_by = (select auth.uid()));

create policy "members can read mix versions"
  on public.mix_versions for select to authenticated
  using (exists (
    select 1 from public.songs s
    where s.id = song_id and private.is_member(s.workspace_id)
  ));

create policy "members can add mix versions as themselves"
  on public.mix_versions for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.songs s
      where s.id = song_id and private.is_member(s.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Every new (non-anonymous) user gets a personal workspace and is its owner.
-- Anonymous users (client share links, ADR 0005) get no workspace.
-- ---------------------------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
begin
  if new.is_anonymous then
    return new;
  end if;

  insert into public.workspaces (name)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My') || '''s studio')
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill: users created before this migration (e.g. on the hosted dev project) get a workspace too.
do $$
declare
  u record;
  new_workspace_id uuid;
begin
  for u in
    select au.id, au.email
    from auth.users au
    where not au.is_anonymous
      and not exists (select 1 from public.workspace_members m where m.user_id = au.id)
  loop
    insert into public.workspaces (name)
    values (coalesce(nullif(split_part(u.email, '@', 1), ''), 'My') || '''s studio')
    returning id into new_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, u.id, 'owner');
  end loop;
end;
$$;
