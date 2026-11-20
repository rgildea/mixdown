-- Invite-only enforced in the database (ADR 0004, amended in #42). Run: npm run db:test
-- Mirrors the probes in docs/spikes/2026-11-20-anonymous-auth-vs-invite-only.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------- Who may be created ----------
select throws_ok(
  $$ insert into auth.users (id, email, aud, role, is_anonymous)
     values ('a0000000-0000-0000-0000-000000000001', 'stranger@example.test', 'authenticated', 'authenticated', false) $$,
  '42501', 'Mixdown is invite-only', 'an uninvited email cannot get an account');

select lives_ok($$ select public.invite_user('  Invited@Example.TEST ') $$, 'invite_user normalises and stores an email');
select is((select count(*)::int from private.invites where email = 'invited@example.test'), 1, 'stored lower-cased and trimmed');
select lives_ok($$ select public.invite_user('invited@example.test') $$, 'inviting twice is harmless');

select lives_ok(
  $$ insert into auth.users (id, email, aud, role, is_anonymous)
     values ('a0000000-0000-0000-0000-000000000002', 'invited@example.test', 'authenticated', 'authenticated', false) $$,
  'an invited email can get an account');
select is((select count(*)::int from public.workspace_members where user_id = 'a0000000-0000-0000-0000-000000000002'), 1,
  'the invited user gets their personal workspace');

select lives_ok(
  $$ insert into auth.users (id, email, aud, role, is_anonymous)
     values ('a0000000-0000-0000-0000-000000000003', null, 'authenticated', 'authenticated', true) $$,
  'anonymous (share-link) users are allowed');
select is((select count(*)::int from public.workspace_members where user_id = 'a0000000-0000-0000-0000-000000000003'), 0,
  'anonymous users get no workspace');

select throws_ok($$ select public.invite_user('not-an-email') $$, '22023', null, 'invalid emails are rejected');

-- ---------- Anonymous users can't upgrade themselves past the allowlist ----------
select throws_ok(
  $$ update auth.users set email = 'sneaky@example.test' where id = 'a0000000-0000-0000-0000-000000000003' $$,
  '42501', 'Mixdown is invite-only', 'an anonymous user cannot set an uninvited email');
select throws_ok(
  $$ update auth.users set is_anonymous = false where id = 'a0000000-0000-0000-0000-000000000003' $$,
  '42501', 'Mixdown is invite-only', 'an anonymous user cannot become permanent without an invited email');
select lives_ok(
  $$ update auth.users set raw_user_meta_data = '{"display_name":"J.R."}' where id = 'a0000000-0000-0000-0000-000000000003' $$,
  'an anonymous user can still set a display name');

select public.invite_user('client@example.test');
select lives_ok(
  $$ update auth.users set email = 'client@example.test', is_anonymous = false where id = 'a0000000-0000-0000-0000-000000000003' $$,
  'an anonymous user CAN become permanent with an invited email (future client accounts)');

-- ---------- Only the service role can invite ----------
select pg_temp.login_as('a0000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.invite_user('friend@example.test') $$, '42501', null, 'a signed-in user cannot invite');
reset role;
set local role anon;
select throws_ok($$ select public.invite_user('friend@example.test') $$, '42501', null, 'a signed-out client cannot invite');
reset role;
set local role service_role;
select lives_ok($$ select public.invite_user('friend@example.test') $$, 'the service role can invite');

select * from finish();
rollback;
