-- Migration 17: moderation. Platform admins (added by hand in the SQL editor, see README) can review reports, mark them and suspend
-- or reactivate accounts. Nobody else can see reports of other people. Every decision is logged. Safe to re-run.
create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

alter table public.reports add column if not exists status text not null default 'open';
alter table public.reports add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists note text;
do $$ begin
  alter table public.reports add constraint reports_status_check check (status in ('open', 'reviewed', 'dismissed', 'actioned'));
exception when duplicate_object then null; end $$;
create index if not exists reports_status_idx on public.reports (status, created_at desc);

create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_user uuid,
  report_id uuid,
  note text,
  created_at timestamptz not null default now()
);
alter table public.moderation_log enable row level security;
revoke all on public.moderation_log from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create or replace function public.admin_list_reports(p_status text default 'open')
returns table (id uuid, reason text, status text, created_at timestamptz, note text, reporter_id uuid, reporter_name text,
               reported_id uuid, reported_name text, reported_phone text, reported_username text, reports_against integer, business_name text, suspended boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  return query
  select r.id, r.reason, r.status, r.created_at, r.note, r.reporter_id, rp.display_name, r.reported_id, dp.display_name, dp.phone, dp.username,
         (select count(*)::integer from public.reports x where x.reported_id = r.reported_id and r.reported_id is not null),
         b.name, coalesce((select u.banned_until > now() from auth.users u where u.id = r.reported_id), false)
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles dp on dp.id = r.reported_id
  left join public.businesses b on b.id = r.business_id
  where (p_status is null or r.status = p_status)
  order by r.created_at desc limit 100;
end;
$$;

create or replace function public.admin_review_report(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('open', 'reviewed', 'dismissed', 'actioned') then raise exception 'invalid_status'; end if;
  update public.reports set status = p_status, reviewed_by = me, reviewed_at = now(), note = left(nullif(btrim(coalesce(p_note, '')), ''), 500) where id = p_id;
  insert into public.moderation_log (admin_id, action, report_id, note) values (me, 'review:' || p_status, p_id, left(p_note, 500));
end;
$$;

-- suspend (or reactivate) an account: the sign-in service refuses banned accounts, so the person cannot open a new session
create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if p_user = me or exists (select 1 from public.platform_admins where user_id = p_user) then raise exception 'cannot_suspend_admin'; end if;
  update auth.users set banned_until = case when p_suspended then now() + interval '100 years' else null end where id = p_user;
  if not found then raise exception 'user_not_found'; end if;
  if p_suspended then update public.reports set status = 'actioned', reviewed_by = me, reviewed_at = now() where reported_id = p_user and status = 'open'; end if;
  insert into public.moderation_log (admin_id, action, target_user, note) values (me, case when p_suspended then 'suspend' else 'reactivate' end, p_user, left(p_note, 500));
end;
$$;

revoke execute on function public.is_platform_admin(), public.admin_list_reports(text), public.admin_review_report(uuid, text, text), public.admin_set_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.is_platform_admin(), public.admin_list_reports(text), public.admin_review_report(uuid, text, text), public.admin_set_suspended(uuid, boolean, text) to authenticated;
