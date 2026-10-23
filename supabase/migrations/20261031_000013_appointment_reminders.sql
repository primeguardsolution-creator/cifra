-- Migration 13: reminder 5 minutes before an appointment, for everyone involved (who created it, who it is assigned to, the invited
-- customer). A cron job runs every minute, marks the appointments that start within 5 minutes and asks the Netlify push function
-- (same pg_net + push_config as messages) to notify every device. Safe to re-run.
alter table public.appointments add column if not exists reminded_at timestamptz;

-- moving an appointment re-arms its reminder
create or replace function public.appointments_rearm_reminder()
returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at or (new.status in ('scheduled', 'confirmed') and old.status not in ('scheduled', 'confirmed')) then new.reminded_at := null; end if;
  return new;
end;
$$;
drop trigger if exists appointments_rearm on public.appointments;
create trigger appointments_rearm before update on public.appointments for each row execute function public.appointments_rearm_reminder();

-- Everything the push sender needs for one appointment reminder (service role only). One row per device of each person involved
-- whose notifications for that space are on (Business for team members, Personal for the invited customer).
drop function if exists public.reminder_payloads(uuid);
create or replace function public.reminder_payloads(p_appt uuid)
returns table (endpoint text, p256dh text, auth text, title text, body text, icon_path text, conversation_id uuid, tag text, url text)
language plpgsql security definer set search_path = public as $q$
#variable_conflict use_column
declare a public.appointments; b public.businesses;
begin
  select * into a from public.appointments where id = p_appt;
  if a.id is null or a.status not in ('scheduled', 'confirmed') then return; end if;
  select * into b from public.businesses where id = a.business_id;
  return query
  with who as (
    select distinct u.user_id from (values (a.created_by), (a.assigned_to), (a.customer_user_id)) as u(user_id) where u.user_id is not null
  ), eligible as (
    select w.user_id, p.locale, coalesce(nullif(p.timezone, ''), 'UTC') as tz,
           exists (select 1 from public.business_members bm where bm.business_id = a.business_id and bm.user_id = w.user_id) as biz
      from who w join public.profiles p on p.id = w.user_id
  )
  select s.endpoint, s.p256dh, s.auth,
         chr(9200) || ' ' || a.title,
         (case coalesce(nullif(e.locale, ''), 'es') when 'en' then 'In 5 minutes' when 'de' then 'In 5 Minuten' else 'En 5 minutos' end)
           || ' ' || chr(183) || ' ' || to_char(a.starts_at at time zone e.tz, 'HH24:MI') || ' ' || chr(183) || ' ' || b.name,
         b.logo_path, a.conversation_id, 'appt-' || a.id::text,
         case when e.biz then '/agenda' else '/my-appointments' end
    from eligible e join public.push_subscriptions s on s.user_id = e.user_id
   where case when e.biz then s.notify_business else s.notify_personal end;
end;
$q$;
revoke all on function public.reminder_payloads(uuid) from public, anon, authenticated;
grant execute on function public.reminder_payloads(uuid) to service_role;

-- Marks and sends the reminders that are due. Appointments created less than 5 minutes ahead are reminded on the next run.
create or replace function public.dispatch_appointment_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare u text; t text; r record; n integer := 0;
begin
  select value into u from public.push_config where key = 'url';
  select value into t from public.push_config where key = 'token';
  for r in
    update public.appointments set reminded_at = now()
     where reminded_at is null and status in ('scheduled', 'confirmed') and starts_at > now() and starts_at <= now() + interval '5 minutes'
    returning id
  loop
    n := n + 1;
    begin
      if u is not null and t is not null then
        perform net.http_post(url := u || '?token=' || t, body := jsonb_build_object('appointment_id', r.id), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 3000);
      end if;
    exception when others then null; -- a push problem never blocks the agenda
    end;
  end loop;
  return n;
end;
$$;
revoke all on function public.dispatch_appointment_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'cifra-appointment-reminders';
    perform cron.schedule('cifra-appointment-reminders', '* * * * *', 'select public.dispatch_appointment_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron not enabled: reminders will not be sent while the app is closed (%)', sqlerrm;
end $$;
