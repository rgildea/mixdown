-- Invite-only enforced IN THE DATABASE (ADR 0004, amended; spike: docs/spikes/2026-11-20-...).
--
-- Why: Supabase's global "signups off" switch also blocks anonymous sign-ins, which client share
-- links need (ADR 0005). So signups are switched ON and this migration decides who may exist:
--   * anonymous users (share-link clients): allowed;
--   * everyone else: only if their email is on private.invites;
--   * an anonymous user may become a permanent account only with an invited email.
-- It fails CLOSED: any project running these migrations is invite-only regardless of dashboard settings.
-- Rollout order on hosted: apply this migration FIRST, then turn signups + anonymous sign-ins on.

create table private.invites (
  email      text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  invited_at timestamptz not null default now()
);
comment on table private.invites is 'Emails allowed to have a (non-anonymous) account. ADR 0004.';

-- Everyone who already has an account is, by definition, invited.
insert into private.invites (email)
select lower(btrim(email)) from auth.users
where not is_anonymous and email is not null and email <> ''
on conflict do nothing;

create function private.is_invited(addr text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select addr is not null and exists (select 1 from private.invites i where i.email = lower(btrim(addr)));
$$;
revoke all on function private.is_invited(text) from public;

create function private.guard_auth_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_anonymous or private.is_invited(new.email) then
      return new;
    end if;
    raise exception 'Mixdown is invite-only' using errcode = '42501';
  end if;

  -- UPDATE: an anonymous user can only turn into a permanent account (or set an email) if invited.
  -- Ordinary updates (metadata such as a display name, session refreshes) pass through.
  if old.is_anonymous
     and (not new.is_anonymous or new.email is distinct from old.email)
     and not private.is_invited(new.email) then
    raise exception 'Mixdown is invite-only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_auth_users() from public;

create trigger guard_auth_users
  before insert or update on auth.users
  for each row execute function private.guard_auth_users();

-- Inviting someone: `select public.invite_user('a@b.com');` in the SQL editor (hosted), or
-- `npm run db:users -- a@b.com` (local). Callable through the API by the service role ONLY.
create function public.invite_user(email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if email is null or btrim(email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Not an email address: %', email using errcode = '22023';
  end if;
  insert into private.invites (email) values (lower(btrim(email))) on conflict do nothing;
end;
$$;
revoke all on function public.invite_user(text) from public, anon, authenticated;
grant execute on function public.invite_user(text) to service_role;
