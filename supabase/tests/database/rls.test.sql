-- RLS tests for the Week 1 schema (ADR 0004). Run: npm run db:test
-- Each test runs inside a transaction that is rolled back, so it never changes the database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- ---------- Fixtures: two engineers and one anonymous (share-link) user ----------
insert into auth.users (id, email, aud, role, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', 'authenticated', 'authenticated', false),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test',   'authenticated', 'authenticated', false),
  ('33333333-3333-3333-3333-333333333333', null,                 'authenticated', 'authenticated', true);

create temp table ws as
  select user_id, workspace_id from public.workspace_members
  where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
grant select on ws to authenticated;

-- Switch the session to a user, the way PostgREST does for a request with their JWT.
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------- Trigger ----------
select is((select count(*)::int from ws), 2, 'each new engineer gets exactly one workspace');
select is(
  (select role from public.workspace_members where user_id = '11111111-1111-1111-1111-111111111111'),
  'owner', 'the new user owns their workspace');
select is(
  (select name from public.workspaces w join ws on ws.workspace_id = w.id
   where ws.user_id = '11111111-1111-1111-1111-111111111111'),
  'alice''s studio', 'workspace is named after the email');
select is(
  (select count(*)::int from public.workspace_members where user_id = '33333333-3333-3333-3333-333333333333'),
  0, 'anonymous users get no workspace');

-- ---------- Alice works in her own workspace ----------
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$ insert into public.songs (workspace_id, title, client_name)
     select workspace_id, 'Alice Song', 'A.B.' from ws where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'a member can create a song in their workspace');
select is((select created_by from public.songs where title = 'Alice Song'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'created_by defaults to the current user');
select is((select count(*)::int from public.workspaces), 1, 'a member sees only their own workspace');

select throws_ok(
  $$ insert into public.songs (workspace_id, title)
     select workspace_id, 'Sneaky' from ws where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'a user cannot create a song in someone else''s workspace');
select throws_ok(
  $$ insert into public.songs (workspace_id, title, created_by)
     select workspace_id, 'Spoofed', '22222222-2222-2222-2222-222222222222'
     from ws where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'a user cannot create a song as someone else');

select lives_ok(
  $$ insert into public.mix_versions (song_id, object_key, original_filename, mime_type, size_bytes)
     select id, 'k/alice-v1.wav', 'mix.wav', 'audio/wav', 1000 from public.songs where title = 'Alice Song' $$,
  'a member can add a version to their song');
select throws_ok(
  $$ insert into public.mix_versions (song_id, object_key, original_filename, mime_type, size_bytes)
     select id, 'k/alice-v2.aiff', 'mix.aiff', 'audio/aiff', 1000 from public.songs where title = 'Alice Song' $$,
  '23514', null, 'unsupported audio types are rejected');

-- No UPDATE/DELETE policies in v1: statements succeed but affect no rows.
update public.songs set title = 'Renamed' where title = 'Alice Song';
delete from public.songs where title = 'Alice Song';
select is((select count(*)::int from public.songs where title = 'Alice Song'), 1,
  'songs cannot be edited or deleted yet (Later list)');
update public.workspace_members set role = 'member';
select is((select role from public.workspace_members), 'owner', 'members cannot change roles');

-- Remember Alice's song id as an admin, so Bob can try to use it directly.
reset role;
create temp table alice_song as select id from public.songs where title = 'Alice Song';
grant select on alice_song to authenticated;

-- ---------- Bob can't see or touch Alice's data ----------
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');

select is((select count(*)::int from public.songs), 0, 'another engineer sees none of Alice''s songs');
select is((select count(*)::int from public.mix_versions), 0, 'another engineer sees none of Alice''s versions');
select is((select count(*)::int from public.workspace_members
           where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'another engineer cannot see Alice''s membership');
select throws_ok(
  $$ insert into public.mix_versions (song_id, object_key, original_filename, mime_type, size_bytes)
     select id, 'k/bob.wav', 'x.wav', 'audio/wav', 1 from alice_song $$,
  '42501', null, 'another engineer cannot add a version to Alice''s song, even knowing its id');

-- ---------- Anonymous share-link user and signed-out clients ----------
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from public.songs), 0, 'anonymous users see no songs without a grant (Week 2)');

reset role;
set local role anon;
select throws_ok('select * from public.songs', '42501', null, 'signed-out (anon) clients get permission denied');

select * from finish();
rollback;
