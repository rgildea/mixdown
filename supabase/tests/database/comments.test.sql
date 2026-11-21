-- Timestamped comments (ADR 0005, issue #46). Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures: engineers Alice and Bob (separate studios); anonymous clients Carol (has Alice's link) and Dave (no link).
select public.invite_user('alice@example.test'), public.invite_user('bob@example.test');
insert into auth.users (id, email, aud, role, is_anonymous) values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', 'authenticated', 'authenticated', false),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test',   'authenticated', 'authenticated', false),
  ('c3333333-3333-3333-3333-333333333333', null,                 'authenticated', 'authenticated', true),
  ('d4444444-4444-4444-4444-444444444444', null,                 'authenticated', 'authenticated', true);

insert into public.songs (id, workspace_id, created_by, title)
select '5a000000-0000-0000-0000-00000000000a', workspace_id, user_id, 'Alice Song'
from public.workspace_members where user_id = 'a1111111-1111-1111-1111-111111111111';
insert into public.songs (id, workspace_id, created_by, title)
select '5b000000-0000-0000-0000-00000000000b', workspace_id, user_id, 'Bob Song'
from public.workspace_members where user_id = 'b2222222-2222-2222-2222-222222222222';
insert into public.mix_versions (id, song_id, object_key, original_filename, mime_type, size_bytes, created_by) values
  ('7a000000-0000-0000-0000-00000000000a', '5a000000-0000-0000-0000-00000000000a', 'k/a.wav', 'a.wav', 'audio/wav', 10, 'a1111111-1111-1111-1111-111111111111'),
  ('7b000000-0000-0000-0000-00000000000b', '5b000000-0000-0000-0000-00000000000b', 'k/b.wav', 'b.wav', 'audio/wav', 10, 'b2222222-2222-2222-2222-222222222222');
insert into public.share_links (song_id, token, created_by) values
  ('5a000000-0000-0000-0000-00000000000a', 'tok-alice-xxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'a1111111-1111-1111-1111-111111111111');
-- Bob's own comment on his song, to check it never leaks.
insert into public.comments (song_id, version_id, at_ms, body, author_user_id, author_name) values
  ('5b000000-0000-0000-0000-00000000000b', '7b000000-0000-0000-0000-00000000000b', 1000, 'Bob note', 'b2222222-2222-2222-2222-222222222222', 'B');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.visible() returns int language sql as $$ select count(*)::int from public.comments $$;

-- ---------- A client with an active grant reads and adds comments on that song ----------
select pg_temp.login_as('c3333333-3333-3333-3333-333333333333');
select is(pg_temp.visible(), 0, 'before redeeming, a client sees no comments');
select throws_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name)
                   values ('5a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000a', 83000, 'x', 'C') $$,
  '42501', null, 'before redeeming, a client cannot comment');
select public.redeem_share_link('tok-alice-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');
-- Regression: the app posts with insert ... returning, which needs the read policy to see the new row.
select lives_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name)
                   values ('5a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000a', 83000, 'Vocal too loud', 'C')
                   returning id $$,
  'a client with a grant can comment and read it back (insert ... returning)');
select lives_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name)
                   values ('5a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000a', null, 'Love it overall', 'C') $$,
  'a comment can have no timestamp (whole mix)');
select is((select author_user_id from public.comments where body = 'Vocal too loud'), 'c3333333-3333-3333-3333-333333333333'::uuid,
  'the author is the caller');
select is(pg_temp.visible(), 2, 'the client sees the comments on their song, and none of Bob''s');

-- ---------- Nobody posts as someone else, on another song, or onto a mismatched version ----------
select throws_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name, author_user_id)
                   values ('5a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000a', 1, 'spoof', 'A',
                           'a1111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'a client cannot set the author (column not writable)');
select throws_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name, created_at)
                   values ('5a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000a', 1, 'old', 'C', '2000-01-01') $$,
  '42501', null, 'a client cannot backdate a comment');
select throws_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name)
                   values ('5b000000-0000-0000-0000-00000000000b', '7b000000-0000-0000-0000-00000000000b', 1, 'x', 'C') $$,
  '42501', null, 'a client cannot comment on a song they were not given');
select throws_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name)
                   values ('5a000000-0000-0000-0000-00000000000a', '7b000000-0000-0000-0000-00000000000b', 1, 'x', 'C') $$,
  '23503', null, 'a comment''s version must belong to its song');
select throws_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name)
                   values ('5a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000a', 1, '   ', 'C') $$,
  '23514', null, 'an empty comment is refused');
select throws_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name)
                   values ('5a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000a', -1, 'x', 'C') $$,
  '23514', null, 'a negative timestamp is refused');

-- ---------- No edits or deletes in v1 ----------
select throws_ok($$ update public.comments set body = 'edited' $$, '42501', null, 'comments cannot be edited');
select throws_ok($$ delete from public.comments $$, '42501', null, 'comments cannot be deleted');

-- ---------- The studio sees its song's comments; other studios and clients see nothing ----------
select pg_temp.login_as('a1111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.comments where song_id = '5a000000-0000-0000-0000-00000000000a'), 2,
  'the engineer sees the client''s comments on their song');
select lives_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name)
                   values ('5a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000a', 83000, 'Fixed in v2', 'A') $$,
  'the engineer can comment on their own song');
select is((select count(*)::int from public.comments where song_id = '5b000000-0000-0000-0000-00000000000b'), 0,
  'an engineer cannot see another studio''s comments');

select pg_temp.login_as('b2222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.comments where song_id = '5a000000-0000-0000-0000-00000000000a'), 0,
  'another studio cannot see Alice''s comments');

select pg_temp.login_as('d4444444-4444-4444-4444-444444444444');
select is(pg_temp.visible(), 0, 'a client without a grant sees no comments');

-- ---------- Revoking the link cuts the client off from comments ----------
select pg_temp.login_as('a1111111-1111-1111-1111-111111111111');
update public.share_links set revoked_at = now() where song_id = '5a000000-0000-0000-0000-00000000000a';
select pg_temp.login_as('c3333333-3333-3333-3333-333333333333');
select is(pg_temp.visible(), 0, 'after revoking, the client sees no comments');
select throws_ok($$ insert into public.comments (song_id, version_id, at_ms, body, author_name)
                   values ('5a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000a', 1, 'x', 'C') $$,
  '42501', null, 'after revoking, the client cannot comment');

-- ---------- Signed-out callers have no access at all ----------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.comments $$, '42501', null, 'signed-out callers cannot read comments');

-- ---------- Comments outlive their author's account (e.g. an anonymous-user cleanup job) ----------
reset role;
delete from auth.users where id = 'c3333333-3333-3333-3333-333333333333';
select is((select count(*)::int from public.comments where body in ('Vocal too loud', 'Love it overall')), 2,
  'deleting a client''s user keeps their comments');
select is((select author_user_id from public.comments where body = 'Vocal too loud'), null,
  '…with no author id (the name still shows who wrote it)');

select * from finish();
rollback;
