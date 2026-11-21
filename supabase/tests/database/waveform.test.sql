-- Waveform peaks + duration on mix_versions (ADR 0010, issue #45). Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Fixtures: engineers Alice and Bob (separate studios), anonymous client Carol.
select public.invite_user('alice@example.test'), public.invite_user('bob@example.test');
insert into auth.users (id, email, aud, role, is_anonymous) values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', 'authenticated', 'authenticated', false),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test',   'authenticated', 'authenticated', false),
  ('c3333333-3333-3333-3333-333333333333', null,                 'authenticated', 'authenticated', true);
insert into public.songs (id, workspace_id, created_by, title)
  select '5a000000-0000-0000-0000-00000000000a', workspace_id, user_id, 'Alice Song'
  from public.workspace_members where user_id = 'a1111111-1111-1111-1111-111111111111';
insert into public.share_links (song_id, token, created_by) values
  ('5a000000-0000-0000-0000-00000000000a', 'tok-wave-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'a1111111-1111-1111-1111-111111111111');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Insert a version of Alice's song with the given duration and peaks (as whoever is logged in).
create function pg_temp.add_version(n int, dur int, p real[]) returns void language sql as $$
  insert into public.mix_versions (song_id, version_number, object_key, original_filename, mime_type, size_bytes, duration_ms, peaks)
  values ('5a000000-0000-0000-0000-00000000000a', n, 'k/a-v' || n || '.wav', 'a.wav', 'audio/wav', 10, dur, p);
$$;

-- ---------- Valid values ----------
select pg_temp.login_as('a1111111-1111-1111-1111-111111111111');
select lives_ok($$ select pg_temp.add_version(1, 215000, array[0, 0.5, 1]::real[]) $$,
  'a member can store duration and peaks with a new version');
select lives_ok($$ select pg_temp.add_version(2, null, null) $$,
  'duration and peaks are optional (unscannable files, older uploads)');
select lives_ok($$ select pg_temp.add_version(3, 24 * 60 * 60 * 1000, array_fill(0.25::real, array[4000])) $$,
  'the largest allowed duration and peak count are accepted');

-- ---------- Out-of-range values are rejected by the database, not just the app ----------
select throws_ok($$ select pg_temp.add_version(10, 0, null) $$, '23514', null, 'a zero duration is rejected');
select throws_ok($$ select pg_temp.add_version(11, -5, null) $$, '23514', null, 'a negative duration is rejected');
select throws_ok($$ select pg_temp.add_version(12, 24 * 60 * 60 * 1000 + 1, null) $$, '23514', null, 'a duration over 24 h is rejected');
select throws_ok($$ select pg_temp.add_version(13, 1000, '{}'::real[]) $$, '23514', null, 'an empty peaks list is rejected');
select throws_ok($$ select pg_temp.add_version(14, 1000, array_fill(0.25::real, array[4001])) $$, '23514', null, 'more than 4,000 peaks are rejected');
select throws_ok($$ select pg_temp.add_version(15, 1000, array[0.5, 1.01]::real[]) $$, '23514', null, 'a peak above 1 is rejected');
select throws_ok($$ select pg_temp.add_version(16, 1000, array[-0.1, 0.5]::real[]) $$, '23514', null, 'a negative peak is rejected');
select throws_ok($$ select pg_temp.add_version(17, 1000, array[0.5, null]::real[]) $$, '23514', null, 'a null peak is rejected');
select throws_ok($$ select pg_temp.add_version(18, 1000, array['NaN']::real[]) $$, '23514', null, 'a NaN peak is rejected');
select throws_ok($$ select pg_temp.add_version(19, 1000, array[[0.1, 0.2], [0.3, 0.4]]::real[]) $$, '23514', null, 'a 2-D peaks array is rejected');

-- ---------- Written once: no one can change them afterwards ----------
update public.mix_versions set peaks = array[1]::real[], duration_ms = 1 where version_number = 1;
select is((select duration_ms from public.mix_versions where version_number = 1), 215000,
  'a member cannot change a version''s duration or peaks after upload (no UPDATE policy)');

-- ---------- Who can read them ----------
select pg_temp.login_as('b2222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.mix_versions where peaks is not null), 0,
  'another studio cannot read the peaks');

select pg_temp.login_as('c3333333-3333-3333-3333-333333333333');
select is((select count(*)::int from public.mix_versions), 0, 'a client without a grant cannot read the peaks');
select is(public.redeem_share_link('tok-wave-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx'), '5a000000-0000-0000-0000-00000000000a'::uuid,
  'the client redeems the share link');
select is((select peaks from public.mix_versions where version_number = 1), array[0, 0.5, 1]::real[],
  'a client with a grant reads the peaks');
select is((select duration_ms from public.mix_versions where version_number = 1), 215000,
  'a client with a grant reads the duration');

update public.mix_versions set peaks = array[0]::real[] where version_number = 1;
reset role;
select is((select peaks from public.mix_versions where version_number = 1), array[0, 0.5, 1]::real[],
  'a client cannot change the peaks');

select * from finish();
rollback;
