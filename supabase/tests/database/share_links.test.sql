-- Share links + client grants (ADR 0005, issue #43). Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Fixtures: engineers Alice and Bob (separate studios), anonymous client Carol.
select public.invite_user('alice@example.test'), public.invite_user('bob@example.test');
insert into auth.users (id, email, aud, role, is_anonymous) values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', 'authenticated', 'authenticated', false),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test',   'authenticated', 'authenticated', false),
  ('c3333333-3333-3333-3333-333333333333', null,                 'authenticated', 'authenticated', true),
  ('d4444444-4444-4444-4444-444444444444', null,                 'authenticated', 'authenticated', true);

create temp table fx (k text primary key, v uuid);
grant select on fx to authenticated;
insert into fx select 'alice_ws', workspace_id from public.workspace_members where user_id = 'a1111111-1111-1111-1111-111111111111';
insert into fx select 'bob_ws',   workspace_id from public.workspace_members where user_id = 'b2222222-2222-2222-2222-222222222222';
insert into public.songs (id, workspace_id, created_by, title) values
  ('5a000000-0000-0000-0000-00000000000a', (select v from fx where k = 'alice_ws'), 'a1111111-1111-1111-1111-111111111111', 'Alice Song'),
  ('5b000000-0000-0000-0000-00000000000b', (select v from fx where k = 'bob_ws'),   'b2222222-2222-2222-2222-222222222222', 'Bob Song');
insert into public.mix_versions (song_id, object_key, original_filename, mime_type, size_bytes, created_by) values
  ('5a000000-0000-0000-0000-00000000000a', 'k/a.wav', 'a.wav', 'audio/wav', 10, 'a1111111-1111-1111-1111-111111111111');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.carol_sees_alice_song() returns int language sql as $$
  select count(*)::int from public.songs where id = '5a000000-0000-0000-0000-00000000000a';
$$;

-- ---------- Engineers manage links for their own songs only ----------
select pg_temp.login_as('a1111111-1111-1111-1111-111111111111');
-- Regression: the app creates songs with `insert ... returning`, which needs the read policy to see the new row.
select lives_ok($$ insert into public.songs (workspace_id, title) select v, 'Returning test' from fx where k = 'alice_ws' returning id $$,
  'a member can create a song and read it back in the same statement (insert ... returning)');
select lives_ok($$ insert into public.share_links (song_id, token) values ('5a000000-0000-0000-0000-00000000000a', 'tok-alice-1-xxxxxxxxxxxxxxxxxxxxxxxxxx') $$,
  'a member can create a link for their song');
select throws_ok($$ insert into public.share_links (song_id, token) values ('5a000000-0000-0000-0000-00000000000a', 'tok-alice-2-xxxxxxxxxxxxxxxxxxxxxxxxxx') $$,
  '23505', null, 'only one active link per song');
select throws_ok($$ insert into public.share_links (song_id, token) values ('5b000000-0000-0000-0000-00000000000b', 'tok-evil-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx') $$,
  '42501', null, 'a member cannot create a link for another studio''s song');
select throws_ok($$ insert into public.share_links (song_id, token, created_by) values ('5a000000-0000-0000-0000-00000000000a', 'tok-spoof-xxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'b2222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'a link cannot be created as someone else');
select throws_ok($$ insert into public.share_links (song_id, token) values ('5a000000-0000-0000-0000-00000000000a', 'aaaa') $$,
  '23514', null, 'tokens must look like generated tokens (format check)');
select throws_ok($$ update public.share_links set token = 'tok-changed-xxxxxxxxxxxxxxxxxxxxxxxxxx' $$,
  '42501', null, 'the token cannot be changed (only revoked_at is updatable)');
select is((select count(*)::int from public.share_links), 1, 'a member sees their song''s link (and can re-copy it)');

select pg_temp.login_as('b2222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.share_links), 0, 'another studio cannot see the link or its token');

-- Capture the link id as an admin so later "attack" inserts use a real id (not a select that RLS empties).
reset role;
insert into fx select 'alice_link', id from public.share_links where token = 'tok-alice-1-xxxxxxxxxxxxxxxxxxxxxxxxxx';

-- ---------- A client without a grant sees nothing ----------
select pg_temp.login_as('c3333333-3333-3333-3333-333333333333');
select is(pg_temp.carol_sees_alice_song(), 0, 'before redeeming, a client cannot read the song');
select is((select count(*)::int from public.share_links), 0, 'clients cannot read share links');
select is(public.redeem_share_link('not-a-real-token'), null, 'a bogus token redeems to nothing');
select is((select count(*)::int from public.song_access), 0, '…and creates no grant');

-- ---------- Redeeming grants read access to exactly that song ----------
select is(public.redeem_share_link('tok-alice-1-xxxxxxxxxxxxxxxxxxxxxxxxxx'), '5a000000-0000-0000-0000-00000000000a'::uuid,
  'redeeming a valid link returns the song');
select is(pg_temp.carol_sees_alice_song(), 1, 'after redeeming, the client can read the song');
select is((select count(*)::int from public.mix_versions), 1, '…and its mix versions');
select is((select count(*)::int from public.songs where id = '5b000000-0000-0000-0000-00000000000b'), 0, '…but no other song');
select throws_ok($$ insert into public.songs (workspace_id, title) select v, 'x' from fx where k = 'alice_ws' $$,
  '42501', null, 'a client cannot create songs');
select throws_ok($$ insert into public.mix_versions (song_id, object_key, original_filename, mime_type, size_bytes)
                   values ('5a000000-0000-0000-0000-00000000000a', 'k/evil.wav', 'e.wav', 'audio/wav', 1) $$,
  '42501', null, 'a client cannot add mix versions');
select throws_ok($$ insert into public.song_access (song_id, user_id, share_link_id)
                   values ('5b000000-0000-0000-0000-00000000000b', 'c3333333-3333-3333-3333-333333333333',
                           (select v from fx where k = 'alice_link')) $$,
  '42501', null, 'a client cannot grant themselves access directly');
update public.share_links set revoked_at = now();
reset role;
select is((select count(*)::int from public.share_links where song_id = '5a000000-0000-0000-0000-00000000000a' and revoked_at is not null), 0, 'a client cannot revoke links');

-- ---------- Grants are private ----------
select pg_temp.login_as('b2222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.song_access), 0, 'another studio cannot see grants on Alice''s song');
update public.share_links set revoked_at = now();
reset role;
select is((select count(*)::int from public.share_links where song_id = '5a000000-0000-0000-0000-00000000000a' and revoked_at is not null), 0, 'another studio cannot revoke Alice''s link');
select pg_temp.login_as('d4444444-4444-4444-4444-444444444444');
select is((select count(*)::int from public.song_access), 0, 'one client cannot see another client''s grant');
select pg_temp.login_as('a1111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.song_access), 1, 'the studio sees grants on its own song');

-- ---------- Revoking cuts off everyone who used the link ----------
select pg_temp.login_as('a1111111-1111-1111-1111-111111111111');
update public.share_links set revoked_at = now() where song_id = '5a000000-0000-0000-0000-00000000000a';
select throws_ok($$ update public.share_links set revoked_at = null where song_id = '5a000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'revoking is final: a member cannot un-revoke a link');
select pg_temp.login_as('c3333333-3333-3333-3333-333333333333');
select is(pg_temp.carol_sees_alice_song(), 0, 'after revoking, the client loses access');
select is((select count(*)::int from public.mix_versions), 0, '…including to the mix versions');
select is(public.redeem_share_link('tok-alice-1-xxxxxxxxxxxxxxxxxxxxxxxxxx'), null, 'a revoked link cannot be redeemed');

-- A new link restores access for whoever redeems it.
select pg_temp.login_as('a1111111-1111-1111-1111-111111111111');
insert into public.share_links (song_id, token) values ('5a000000-0000-0000-0000-00000000000a', 'tok-alice-3-xxxxxxxxxxxxxxxxxxxxxxxxxx');
select pg_temp.login_as('c3333333-3333-3333-3333-333333333333');
select isnt(public.redeem_share_link('tok-alice-3-xxxxxxxxxxxxxxxxxxxxxxxxxx'), null, 'a new link can be redeemed');
select is(pg_temp.carol_sees_alice_song(), 1, 'and restores access');

-- ---------- Expired links grant nothing ----------
reset role;
update public.share_links set expires_at = now() - interval '1 minute' where token = 'tok-alice-3-xxxxxxxxxxxxxxxxxxxxxxxxxx';
select pg_temp.login_as('c3333333-3333-3333-3333-333333333333');
select is(pg_temp.carol_sees_alice_song(), 0, 'an expired link no longer grants access');
select is((select count(*)::int from public.mix_versions), 0, '…including to the mix versions');

-- ---------- Members don't get client grants; signed-out callers can't redeem ----------
reset role;
update public.share_links set expires_at = null where token = 'tok-alice-3-xxxxxxxxxxxxxxxxxxxxxxxxxx';
select pg_temp.login_as('a1111111-1111-1111-1111-111111111111');
select isnt(public.redeem_share_link('tok-alice-3-xxxxxxxxxxxxxxxxxxxxxxxxxx'), null, 'a member opening their own link works');
select is((select count(*)::int from public.song_access where user_id = 'a1111111-1111-1111-1111-111111111111'), 0, '…without creating a client grant');
select set_config('request.jwt.claims', '{}', true);
select throws_ok($$ select public.redeem_share_link('tok-alice-3-xxxxxxxxxxxxxxxxxxxxxxxxxx') $$,
  '42501', 'Sign in required', 'redeem refuses a caller with no user (the function''s own check)');
reset role;
set local role anon;
select throws_ok($$ select public.redeem_share_link('tok-alice-3-xxxxxxxxxxxxxxxxxxxxxxxxxx') $$, '42501', null, 'signed-out callers cannot redeem (no execute privilege)');

select * from finish();
rollback;
