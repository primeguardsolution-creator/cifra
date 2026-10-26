-- Migration 14: account recovery. A verified e-mail (6-digit code) and a one-time recovery code let a person get back into an
-- account whose password they forgot. Everything secret is stored hashed, only the server (service role, Netlify function
-- /api/recovery) can read or write the table, and every code has attempt limits and an expiry. Safe to re-run.
create table if not exists public.account_recovery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  email_verified_at timestamptz,
  email_pending text,
  otp_hash text,
  otp_purpose text check (otp_purpose in ('verify', 'reset')),
  otp_expires_at timestamptz,
  otp_attempts integer not null default 0,
  sends_window_start timestamptz,
  sends_in_window integer not null default 0,
  last_sent_at timestamptz,
  recovery_code_hash text,
  recovery_code_created_at timestamptz,
  code_failures integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.account_recovery enable row level security;
revoke all on public.account_recovery from anon, authenticated;

-- Who is behind a phone number (server only): id, whether a verified e-mail exists and whether a recovery code was issued.
create or replace function public.recovery_lookup(p_phone text)
returns table (user_id uuid, has_email boolean, email text, has_code boolean)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(r.email_verified_at is not null, false), case when r.email_verified_at is not null then r.email end, coalesce(r.recovery_code_hash is not null, false)
  from public.profiles p left join public.account_recovery r on r.user_id = p.id
  where p.phone = p_phone limit 1;
$$;

-- Starts an e-mail code (verification of a new address, or a password reset). Max 5 sends per hour, 60 s apart.
create or replace function public.recovery_begin_email(p_user uuid, p_email text, p_otp_hash text, p_purpose text, p_ttl_minutes integer default 10)
returns void language plpgsql security definer set search_path = public as $$
declare r public.account_recovery;
begin
  if p_purpose not in ('verify', 'reset') then raise exception 'bad_purpose'; end if;
  insert into public.account_recovery (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into r from public.account_recovery where user_id = p_user for update;
  if r.last_sent_at is not null and r.last_sent_at > now() - interval '60 seconds' then raise exception 'rate_limited'; end if;
  if r.sends_window_start is null or r.sends_window_start < now() - interval '1 hour' then r.sends_window_start := now(); r.sends_in_window := 0; end if;
  if r.sends_in_window >= 5 then raise exception 'rate_limited'; end if;
  update public.account_recovery set
    otp_hash = p_otp_hash, otp_purpose = p_purpose, otp_expires_at = now() + make_interval(mins => greatest(1, least(30, p_ttl_minutes))), otp_attempts = 0,
    email_pending = case when p_purpose = 'verify' then lower(btrim(p_email)) else email_pending end,
    sends_window_start = r.sends_window_start, sends_in_window = r.sends_in_window + 1, last_sent_at = now(), updated_at = now()
  where user_id = p_user;
end;
$$;

-- Checks a 6-digit code. 5 wrong tries burn it. A good 'verify' code makes the pending address the verified one.
create or replace function public.recovery_check_otp(p_user uuid, p_otp_hash text, p_purpose text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.account_recovery;
begin
  select * into r from public.account_recovery where user_id = p_user for update;
  if r.user_id is null or r.otp_hash is null or r.otp_purpose is distinct from p_purpose or r.otp_expires_at < now() then return false; end if;
  if r.otp_attempts >= 5 then return false; end if;
  if r.otp_hash <> p_otp_hash then
    update public.account_recovery set otp_attempts = otp_attempts + 1, otp_hash = case when otp_attempts + 1 >= 5 then null else otp_hash end where user_id = p_user;
    return false;
  end if;
  update public.account_recovery set otp_hash = null, otp_expires_at = null, otp_attempts = 0,
    email = case when p_purpose = 'verify' then email_pending else email end,
    email_verified_at = case when p_purpose = 'verify' then now() else email_verified_at end,
    email_pending = case when p_purpose = 'verify' then null else email_pending end, updated_at = now()
  where user_id = p_user;
  return true;
end;
$$;

create or replace function public.recovery_set_code(p_user uuid, p_code_hash text)
returns void language sql security definer set search_path = public as $$
  insert into public.account_recovery (user_id, recovery_code_hash, recovery_code_created_at, code_failures, locked_until)
  values (p_user, p_code_hash, now(), 0, null)
  on conflict (user_id) do update set recovery_code_hash = excluded.recovery_code_hash, recovery_code_created_at = now(), code_failures = 0, locked_until = null, updated_at = now();
$$;

-- Checks the recovery code: 5 wrong tries lock it for 15 minutes; a good one is consumed (the person must create a new one).
create or replace function public.recovery_check_code(p_user uuid, p_code_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.account_recovery;
begin
  select * into r from public.account_recovery where user_id = p_user for update;
  if r.user_id is null or r.recovery_code_hash is null then return false; end if;
  if r.locked_until is not null and r.locked_until > now() then return false; end if;
  if r.recovery_code_hash <> p_code_hash then
    update public.account_recovery set code_failures = case when code_failures + 1 >= 5 then 0 else code_failures + 1 end,
      locked_until = case when code_failures + 1 >= 5 then now() + interval '15 minutes' else locked_until end where user_id = p_user;
    return false;
  end if;
  update public.account_recovery set recovery_code_hash = null, code_failures = 0, locked_until = null, updated_at = now() where user_id = p_user;
  return true;
end;
$$;

revoke all on function public.recovery_lookup(text), public.recovery_begin_email(uuid, text, text, text, integer), public.recovery_check_otp(uuid, text, text), public.recovery_set_code(uuid, text), public.recovery_check_code(uuid, text) from public, anon, authenticated;
grant execute on function public.recovery_lookup(text), public.recovery_begin_email(uuid, text, text, text, integer), public.recovery_check_otp(uuid, text, text), public.recovery_set_code(uuid, text), public.recovery_check_code(uuid, text) to service_role;

-- What the signed-in person sees in Settings: masked e-mail, whether it is verified and whether a recovery code exists.
create or replace function public.my_recovery_status()
returns table (email_masked text, email_verified boolean, has_code boolean, code_created_at timestamptz, pending_email text)
language sql stable security definer set search_path = public as $$
  select case when r.email is null then null else left(split_part(r.email, '@', 1), 2) || repeat('*', 3) || '@' || split_part(r.email, '@', 2) end,
         r.email_verified_at is not null, r.recovery_code_hash is not null, r.recovery_code_created_at, r.email_pending
  from (select 1) x left join public.account_recovery r on r.user_id = (select auth.uid());
$$;
revoke execute on function public.my_recovery_status() from public, anon;
grant execute on function public.my_recovery_status() to authenticated;
