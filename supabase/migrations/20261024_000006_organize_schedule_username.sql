-- CIFRA v6: chat organization (pin / archive / mark unread), starred messages, scheduled messages,
-- @username discovery + phone privacy, message search. Safe to re-run.

-- ── Profiles: phone privacy ───────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists hide_phone boolean not null default false;
revoke update on public.profiles from authenticated;
grant update (display_name, username, bio, avatar_path, locale, timezone, discoverable, hide_phone) on public.profiles to authenticated;

create or replace function public.get_profiles(p_ids uuid[])
returns table (id uuid, display_name text, avatar_path text, phone text, bio text)
language sql stable security definer set search_path = public as $q$
  select p.id, p.display_name, p.avatar_path,
         case when p.id = (select auth.uid()) or (public.shares_conversation_with(p.id) and not p.hide_phone) then p.phone end,
         p.bio
  from public.profiles p
  where p.id = any (p_ids)
    and (p.id = (select auth.uid()) or public.shares_conversation_with(p.id) or public.shares_business_with(p.id));
$q$;

-- Find someone by their public @username (so people never have to share a phone number).
create or replace function public.find_user_by_username(p_username text)
returns table (id uuid, display_name text, avatar_path text, phone text, is_self boolean)
language plpgsql security definer set search_path = public as $q$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
  q text := lower(regexp_replace(coalesce(p_username, ''), '^@', ''));
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if q !~ '^[a-z0-9_]{3,32}$' then return; end if;
  perform public.check_rate('lookup', 40, interval '1 minute');
  return query
    select p.id, p.display_name, p.avatar_path, case when p.hide_phone and p.id <> me then null else p.phone end, p.id = me
    from public.profiles p where p.username = q;
end;
$q$;

-- ── Chat organization ────────────────────────────────────────────────────────────────────────────
alter table public.conversation_members add column if not exists pinned_at timestamptz;
alter table public.conversation_members add column if not exists archived boolean not null default false;
alter table public.conversation_members add column if not exists marked_unread boolean not null default false;
revoke update on public.conversation_members from authenticated;
grant update (last_read_at, muted_until, pinned_at, archived, marked_unread) on public.conversation_members to authenticated;

create or replace function public.mark_read(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $q$
declare me uuid := (select auth.uid());
begin
  if me is null or not public.can_access_conversation(p_conv) then raise exception 'forbidden'; end if;
  insert into public.conversation_members (conversation_id, user_id, last_read_at)
  values (p_conv, me, now())
  on conflict (conversation_id, user_id) do update set last_read_at = now(), marked_unread = false;
end;
$q$;

create or replace function public.set_chat_flags(p_conv uuid, p_pinned boolean default null, p_archived boolean default null, p_unread boolean default null, p_muted_until timestamptz default null, p_unmute boolean default false)
returns void language plpgsql security definer set search_path = public as $q$
declare me uuid := (select auth.uid());
begin
  if me is null or not public.can_access_conversation(p_conv) then raise exception 'forbidden'; end if;
  if p_pinned is true and (select count(*) from public.conversation_members where user_id = me and pinned_at is not null and conversation_id <> p_conv) >= 5 then
    raise exception 'too_many_pinned';
  end if;
  insert into public.conversation_members (conversation_id, user_id, last_read_at) values (p_conv, me, now()) on conflict do nothing;
  update public.conversation_members
     set pinned_at = case when p_pinned is null then pinned_at when p_pinned then coalesce(pinned_at, now()) else null end,
         archived = coalesce(p_archived, archived),
         marked_unread = coalesce(p_unread, marked_unread),
         muted_until = case when p_unmute then null else coalesce(p_muted_until, muted_until) end
   where conversation_id = p_conv and user_id = me;
end;
$q$;

drop function if exists public.list_chats(uuid, uuid);
create or replace function public.list_chats(p_business uuid default null, p_conv uuid default null)
returns table (
  id uuid, kind public.conversation_kind, title text, state public.conversation_state,
  business_id uuid, assigned_to uuid, perspective text, created_at timestamptz,
  peer_id uuid, peer_name text, peer_avatar text, peer_phone text,
  business_name text, business_handle text, member_count integer,
  last_message_id uuid, last_body text, last_sender uuid, last_attachment_type text,
  last_deleted boolean, last_internal boolean, last_at timestamptz,
  unread integer, muted_until timestamptz, pinned_at timestamptz, archived boolean, marked_unread boolean
)
language plpgsql stable security definer set search_path = public as $q$
#variable_conflict use_column
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_business is not null and not public.is_business_member(p_business) then raise exception 'forbidden'; end if;
  return query
  select
    c.id, c.kind, c.title, c.state, c.business_id, c.assigned_to, v.perspective, c.created_at,
    peer.id,
    case when c.kind = 'business' and v.perspective = 'personal' then b.name
         when c.kind = 'group' then c.title
         else coalesce(ct.display_name, peer.display_name) end,
    case when c.kind = 'business' and v.perspective = 'personal' then b.logo_path else peer.avatar_path end,
    case when (c.kind = 'direct' or v.perspective = 'agent') and not peer.hide_phone then peer.phone end,
    b.name, b.handle,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    lm.id, lm.body, lm.sender_id, lm.attachment_type, (lm.deleted_at is not null), lm.is_internal, lm.created_at,
    (select count(*)::int from public.messages m
      where m.conversation_id = c.id and m.deleted_at is null and not m.is_internal and m.sender_id <> me
        and m.created_at > coalesce(cm.last_read_at, '-infinity'::timestamptz)
        and (v.perspective <> 'agent' or m.sender_id = c.customer_id)),
    cm.muted_until, cm.pinned_at, coalesce(cm.archived, false), coalesce(cm.marked_unread, false)
  from public.conversations c
  left join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id = me
  left join public.businesses b on b.id = c.business_id
  cross join lateral (
    select case when c.kind = 'business' and c.customer_id is distinct from me and public.is_business_member(c.business_id)
                then 'agent' else 'personal' end as perspective
  ) v
  left join lateral (
    select p.* from public.profiles p
    where p.id = case when c.kind = 'direct'
                      then (select m.user_id from public.conversation_members m where m.conversation_id = c.id and m.user_id <> me limit 1)
                      when v.perspective = 'agent' then c.customer_id end
  ) peer on true
  left join lateral (
    select k.display_name from public.contacts k where k.owner_id = me and k.contact_user_id = peer.id limit 1
  ) ct on true
  left join lateral (
    select m.* from public.messages m
    where m.conversation_id = c.id and (v.perspective = 'agent' or not m.is_internal)
    order by m.created_at desc limit 1
  ) lm on true
  where (p_conv is null or c.id = p_conv)
    and case
          when p_conv is not null then public.can_access_conversation(c.id)
          when p_business is null then cm.user_id is not null and (c.kind <> 'business' or c.customer_id = me)
          else c.kind = 'business' and c.business_id = p_business
        end
  order by cm.pinned_at desc nulls last, coalesce(lm.created_at, c.created_at) desc;
end;
$q$;

-- ── Starred messages ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.starred_messages (
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
alter table public.starred_messages enable row level security;
revoke all on public.starred_messages from anon;
grant select, insert, delete on public.starred_messages to authenticated;
drop policy if exists "starred: own read" on public.starred_messages;
create policy "starred: own read" on public.starred_messages for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "starred: add own" on public.starred_messages;
create policy "starred: add own" on public.starred_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_access_conversation(public.message_conversation(message_id)));
drop policy if exists "starred: remove own" on public.starred_messages;
create policy "starred: remove own" on public.starred_messages for delete to authenticated using (user_id = (select auth.uid()));

-- ── Scheduled messages (sent by the server even if the app is closed) ───────────────────────────
create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  reply_to_id uuid references public.messages(id) on delete set null,
  is_internal boolean not null default false,
  send_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_due_idx on public.scheduled_messages (send_at);
create index if not exists scheduled_sender_idx on public.scheduled_messages (sender_id, conversation_id);
alter table public.scheduled_messages enable row level security;
revoke all on public.scheduled_messages from anon;
grant select, insert, delete on public.scheduled_messages to authenticated;
drop policy if exists "scheduled: own read" on public.scheduled_messages;
create policy "scheduled: own read" on public.scheduled_messages for select to authenticated using (sender_id = (select auth.uid()));
drop policy if exists "scheduled: schedule own" on public.scheduled_messages;
create policy "scheduled: schedule own" on public.scheduled_messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and public.can_send_to_conversation(conversation_id)
  and send_at > now() - interval '1 minute' and send_at < now() + interval '30 days'
  and (not is_internal or public.is_conversation_agent(conversation_id))
);
drop policy if exists "scheduled: cancel own" on public.scheduled_messages;
create policy "scheduled: cancel own" on public.scheduled_messages for delete to authenticated using (sender_id = (select auth.uid()));

create or replace function public.can_user_send(p_user uuid, p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $q$
  select (exists (select 1 from public.conversation_members m where m.conversation_id = p_conv and m.user_id = p_user)
          or exists (select 1 from public.conversations c join public.business_members bm on bm.business_id = c.business_id where c.id = p_conv and bm.user_id = p_user))
     and not exists (
       select 1 from public.conversations c
       join public.conversation_members m on m.conversation_id = c.id and m.user_id <> p_user
       join public.user_blocks b on (b.blocker_id = p_user and b.blocked_id = m.user_id) or (b.blocked_id = p_user and b.blocker_id = m.user_id)
       where c.id = p_conv and c.kind = 'direct');
$q$;

create or replace function public.dispatch_scheduled_messages()
returns integer language plpgsql security definer set search_path = public as $q$
declare r record; sent integer := 0;
begin
  for r in select * from public.scheduled_messages where send_at <= now() order by send_at limit 200 for update skip locked loop
    if public.can_user_send(r.sender_id, r.conversation_id) then
      insert into public.messages (conversation_id, sender_id, body, reply_to_id, is_internal)
      values (r.conversation_id, r.sender_id, r.body, r.reply_to_id, r.is_internal);
      sent := sent + 1;
    end if;
    delete from public.scheduled_messages where id = r.id;
  end loop;
  return sent;
end;
$q$;

-- run every minute on the server when pg_cron is available (the app also triggers it while open)
do $q$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'cifra-dispatch-scheduled';
    perform cron.schedule('cifra-dispatch-scheduled', '* * * * *', 'select public.dispatch_scheduled_messages()');
  end if;
exception when others then
  raise notice 'pg_cron not enabled: scheduled messages will be sent while the app is open (%)', sqlerrm;
end $q$;

-- ── Search ───────────────────────────────────────────────────────────────────────────────────────
create or replace function public.search_messages(p_query text, p_limit integer default 40)
returns table (id uuid, conversation_id uuid, sender_id uuid, body text, created_at timestamptz)
language sql stable security invoker set search_path = public as $q$
  select m.id, m.conversation_id, m.sender_id, m.body, m.created_at
  from public.messages m
  where char_length(btrim(coalesce(p_query, ''))) >= 2
    and m.deleted_at is null and m.body ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by m.created_at desc
  limit least(coalesce(p_limit, 40), 100);
$q$;

do $q$
begin
  create extension if not exists pg_trgm with schema extensions;
  create index if not exists messages_body_trgm on public.messages using gin (body extensions.gin_trgm_ops);
exception when others then
  raise notice 'trigram index skipped: %', sqlerrm;
end $q$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
notify pgrst, 'reload schema';
