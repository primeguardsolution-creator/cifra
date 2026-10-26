-- Migration 18: disappearing messages. Any member of a direct chat or a group can set a timer (24 h, 7 days or 90 days); from then on every
-- new message in that chat gets an expiry. Expired messages are hidden at once (row-level security) and deleted by a job every minute.
-- Business chats and incognito chats do not use this (incognito has its own timer). Safe to re-run.
alter table public.conversations add column if not exists disappear_seconds integer;
do $$ begin
  alter table public.conversations add constraint conversations_disappear_check check (disappear_seconds is null or disappear_seconds in (86400, 604800, 7776000));
exception when duplicate_object then null; end $$;
alter table public.messages add column if not exists expires_at timestamptz;
create index if not exists messages_expires_idx on public.messages (expires_at) where expires_at is not null;

create or replace function public.stamp_message_expiry()
returns trigger language plpgsql security definer set search_path = public as $$
declare ttl integer;
begin
  if new.is_automated then return new; end if;
  select disappear_seconds into ttl from public.conversations where id = new.conversation_id;
  if ttl is not null then new.expires_at := now() + make_interval(secs => ttl); end if;
  return new;
end;
$$;
drop trigger if exists messages_stamp_expiry on public.messages;
create trigger messages_stamp_expiry before insert on public.messages for each row execute function public.stamp_message_expiry();

-- expired messages disappear for everyone immediately, even before the job removes them
drop policy if exists "messages: participants read" on public.messages;
create policy "messages: participants read" on public.messages for select to authenticated using (
  public.can_access_conversation(conversation_id) and (not is_internal or public.is_conversation_agent(conversation_id))
  and (expires_at is null or expires_at > now())
);

create or replace function public.get_disappearing(p_conv uuid)
returns integer language sql stable security definer set search_path = public as $$
  select c.disappear_seconds from public.conversations c where c.id = p_conv and public.is_conversation_member(c.id);
$$;

-- p_seconds: 86400, 604800, 7776000, or null / 0 to switch it off. A notice line is left in the chat so both sides know.
create or replace function public.set_disappearing(p_conv uuid, p_seconds integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  secs integer := nullif(p_seconds, 0);
  c public.conversations;
  label text;
begin
  select * into c from public.conversations where id = p_conv;
  if c.id is null or not public.is_conversation_member(p_conv) then raise exception 'forbidden'; end if;
  if c.kind not in ('direct', 'group') or c.incognito then raise exception 'not_supported'; end if;
  if secs is not null and secs not in (86400, 604800, 7776000) then raise exception 'invalid_timer'; end if;
  perform public.check_rate('disappearing', 30, interval '1 hour');
  update public.conversations set disappear_seconds = secs where id = p_conv;
  label := case secs when 86400 then '24 h' when 604800 then '7 d' when 7776000 then '90 d' else null end;
  insert into public.messages (conversation_id, sender_id, body, is_automated)
  values (p_conv, me, chr(9203) || ' ' || case when secs is null then 'Mensajes temporales desactivados' else 'Mensajes temporales: ' || label end, true);
end;
$$;

create or replace function public.purge_expired_messages()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.messages where expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_expired_messages() from public, anon, authenticated;

revoke execute on function public.get_disappearing(uuid), public.set_disappearing(uuid, integer) from public, anon;
grant execute on function public.get_disappearing(uuid), public.set_disappearing(uuid, integer) to authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'cifra-purge-messages';
    perform cron.schedule('cifra-purge-messages', '* * * * *', 'select public.purge_expired_messages()');
  end if;
exception when others then
  raise notice 'pg_cron not enabled: expired messages are hidden at once but removed only when the job can run (%)', sqlerrm;
end $$;
