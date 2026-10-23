-- CIFRA v11: no automatic greeting when the business wrote first, sender name + photo in chat lists, and Web Push
-- (notifications that reach the iPhone home screen). Safe to re-run. Pure ASCII.

-- - 1. The welcome message answers a customer who writes first; it must not fire when the team opened the conversation.
create or replace function public.after_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  b public.businesses;
begin
  update public.conversations set updated_at = now() where id = new.conversation_id returning * into c;
  if c.kind = 'business' and not new.is_internal and not new.is_automated and new.sender_id = c.customer_id then
    if c.state in ('resolved', 'closed') then
      update public.conversations set state = 'open' where id = c.id;
    end if;
    select * into b from public.businesses where id = c.business_id;
    if coalesce(b.greeting, '') <> ''
       and (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id = c.customer_id and not m.is_internal) = 1
       -- the team (or an appointment card sent by it) already wrote in this conversation: do not greet someone we contacted first
       and not exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id <> c.customer_id and not m.is_automated and not m.is_internal) then
      insert into public.messages (conversation_id, sender_id, body, is_automated) values (c.id, b.owner_id, b.greeting, true);
    elsif b.away_enabled and coalesce(b.away_message, '') <> ''
       and not exists (select 1 from public.messages m where m.conversation_id = c.id and m.is_automated and m.body = b.away_message and m.created_at > now() - interval '12 hours') then
      insert into public.messages (conversation_id, sender_id, body, is_automated) values (c.id, b.owner_id, b.away_message, true);
    end if;
  end if;
  return null;
end;
$$;

-- - 2. Chat list: who wrote the last message (name + photo)
drop function if exists public.list_chats(uuid, uuid);
create or replace function public.list_chats(p_business uuid default null, p_conv uuid default null)
returns table (
  id uuid, kind public.conversation_kind, title text, state public.conversation_state,
  business_id uuid, assigned_to uuid, perspective text, created_at timestamptz,
  peer_id uuid, peer_name text, peer_avatar text, peer_phone text,
  business_name text, business_handle text, member_count integer,
  last_message_id uuid, last_body text, last_sender uuid, last_attachment_type text,
  last_deleted boolean, last_internal boolean, last_at timestamptz,
  unread integer, muted_until timestamptz, pinned_at timestamptz, archived boolean, marked_unread boolean,
  incognito boolean, expires_at timestamptz, destroy_mine boolean, destroy_peer boolean,
  last_delivered boolean, last_read boolean,
  last_sender_name text, last_sender_avatar text
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
    case when c.incognito then c.title
         when c.kind = 'business' and v.perspective = 'personal' then b.name
         when c.kind = 'group' then c.title
         else coalesce(ct.display_name, peer.display_name) end,
    case when c.kind = 'business' and v.perspective = 'personal' then b.logo_path else peer.avatar_path end,
    case when not c.incognito and (c.kind = 'direct' or v.perspective = 'agent') and not peer.hide_phone then peer.phone end,
    b.name, b.handle,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    lm.id, lm.body, lm.sender_id, lm.attachment_type, (lm.deleted_at is not null), lm.is_internal, lm.created_at,
    (select count(*)::int from public.messages m
      where m.conversation_id = c.id and m.deleted_at is null and not m.is_internal and m.sender_id <> me
        and m.created_at > coalesce(cm.last_read_at, '-infinity'::timestamptz)
        and (v.perspective <> 'agent' or m.sender_id = c.customer_id)),
    cm.muted_until, cm.pinned_at, coalesce(cm.archived, false), coalesce(cm.marked_unread, false),
    c.incognito, c.expires_at, (cm.destroy_requested_at is not null),
    exists (select 1 from public.conversation_members o where o.conversation_id = c.id and o.user_id <> me and o.destroy_requested_at is not null),
    -- receipts for the last message when I sent it: delivered = someone else's app fetched it, read = someone else opened the chat
    (lm.sender_id = me and exists (select 1 from public.conversation_members o where o.conversation_id = c.id and o.user_id <> me and coalesce(o.last_delivered_at, o.last_read_at) >= lm.created_at)),
    (lm.sender_id = me and exists (select 1 from public.conversation_members o where o.conversation_id = c.id and o.user_id <> me and o.last_read_at >= lm.created_at)),
    -- who wrote the last message (a business shows its own name for automated replies); never exposed inside incognito rooms
    case when c.incognito then null when lm.is_automated then b.name else lsp.display_name end,
    case when c.incognito or lm.is_automated then null else lsp.avatar_path end
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
  left join lateral (select p2.display_name, p2.avatar_path from public.profiles p2 where p2.id = (select m3.sender_id from public.messages m3 where m3.conversation_id = c.id and (v.perspective = 'agent' or not m3.is_internal) order by m3.created_at desc limit 1)) lsp on true
  left join lateral (
    select m.* from public.messages m
    where m.conversation_id = c.id and (v.perspective = 'agent' or not m.is_internal)
    order by m.created_at desc limit 1
  ) lm on true
  where (p_conv is null or c.id = p_conv)
    and not (c.incognito and c.expires_at < now())
    and case
          when p_conv is not null then public.can_access_conversation(c.id)
          when p_business is null then cm.user_id is not null and (c.kind <> 'business' or c.customer_id = me)
          else c.kind = 'business' and c.business_id = p_business
        end
  order by cm.pinned_at desc nulls last, coalesce(lm.created_at, c.created_at) desc;
end;
$q$;

-- - 3. Web Push: one row per device that allowed notifications
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then raise exception 'invalid_subscription'; end if;
  perform public.check_rate('push_subscribe', 30, interval '1 hour');
  -- the same phone can switch accounts: the endpoint always belongs to whoever registered it last
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) values (me, p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update set user_id = me, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
end;
$$;

create or replace function public.push_label(p_locale text, p_kind text)
returns text language sql immutable as $$
  -- fixed phrases in the receiver's language; accents built with chr() to keep the file ASCII
  select case coalesce(nullif(p_locale, ''), 'es') || ':' || p_kind
    when 'en:image' then 'Photo' when 'de:image' then 'Foto' when 'es:image' then 'Foto'
    when 'en:video' then 'Video' when 'de:video' then 'Video' when 'es:video' then 'V' || chr(237) || 'deo'
    when 'en:audio' then 'Voice message' when 'de:audio' then 'Sprachnachricht' when 'es:audio' then 'Mensaje de voz'
    when 'en:file' then 'File' when 'de:file' then 'Datei' when 'es:file' then 'Archivo'
    when 'en:appt' then 'Appointment' when 'de:appt' then 'Termin' when 'es:appt' then 'Cita'
    when 'en:call' then 'Call' when 'de:call' then 'Anruf' when 'es:call' then 'Llamada'
    when 'en:new' then 'New message' when 'de:new' then 'Neue Nachricht' when 'es:new' then 'Mensaje nuevo'
    else p_kind end;
$$;

-- Everything the push sender needs for one message: who to notify, with what title/body/icon. Only the server (service role)
-- can run it; the Netlify function calls it right after a message is inserted.
create or replace function public.push_payloads(p_message uuid)
returns table (endpoint text, p256dh text, auth text, title text, body text, icon_path text, conversation_id uuid, tag text)
language plpgsql security definer set search_path = public as $q$
#variable_conflict use_column
declare
  m public.messages;
  c public.conversations;
  b public.businesses;
  sender public.profiles;
begin
  select * into m from public.messages where id = p_message;
  if m.id is null or m.deleted_at is not null or m.is_internal then return; end if;
  select * into c from public.conversations where id = m.conversation_id;
  select * into sender from public.profiles where id = m.sender_id;
  if c.business_id is not null then select * into b from public.businesses where id = c.business_id; end if;
  return query
  with recipients as (
    -- direct, group and the customer side of a business chat
    select cm.user_id, cm.muted_until from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id <> m.sender_id
    union
    -- a customer wrote to the business: the assigned agent, or every agent when nobody is assigned
    select bm.user_id, null::timestamptz from public.business_members bm
     where c.kind = 'business' and m.sender_id = c.customer_id and bm.business_id = c.business_id and bm.role in ('owner', 'admin', 'supervisor', 'agent')
       and bm.user_id <> m.sender_id and (c.assigned_to is null or bm.user_id = c.assigned_to)
  ), eligible as (
    select r.user_id, p.locale, coalesce((select k.display_name from public.contacts k where k.owner_id = r.user_id and k.contact_user_id = m.sender_id limit 1), sender.display_name) as sender_name
      from recipients r join public.profiles p on p.id = r.user_id
     where (r.muted_until is null or r.muted_until < now())
       and not exists (select 1 from public.user_blocks ub where (ub.blocker_id = r.user_id and ub.blocked_id = m.sender_id) or (ub.blocker_id = m.sender_id and ub.blocked_id = r.user_id))
  )
  select s.endpoint, s.p256dh, s.auth,
         case when c.incognito then 'CIFRA'
              when c.kind = 'business' and m.sender_id = c.customer_id then e.sender_name || ' ' || chr(183) || ' ' || b.name
              when c.kind = 'business' then b.name
              when c.kind = 'group' then coalesce(c.title, 'CIFRA')
              else e.sender_name end,
         left(case
                when c.incognito then public.push_label(e.locale, 'new')
                else (case when c.kind in ('group') or (c.kind = 'business' and m.sender_id <> c.customer_id and not m.is_automated) then e.sender_name || ': ' else '' end)
                     || case
                          when m.body like chr(128197) || '%' then public.push_label(e.locale, 'appt')
                          when m.body like chr(128222) || '%' or m.body like chr(128249) || '%' then public.push_label(e.locale, 'call')
                          when coalesce(btrim(m.body), '') <> '' then m.body
                          when m.attachment_type like 'image%' then public.push_label(e.locale, 'image')
                          when m.attachment_type like 'video%' then public.push_label(e.locale, 'video')
                          when m.attachment_type like 'audio%' then public.push_label(e.locale, 'audio')
                          else public.push_label(e.locale, 'file') end
              end, 160),
         case when c.incognito then null when c.kind = 'business' and m.sender_id <> c.customer_id then coalesce(b.logo_path, sender.avatar_path) else sender.avatar_path end,
         c.id, 'chat-' || c.id::text
    from eligible e join public.push_subscriptions s on s.user_id = e.user_id;
end;
$q$;
-- sender e.sender_name is per recipient (their own contact alias): the title above already uses it
revoke all on function public.push_payloads(uuid) from public, anon, authenticated;
grant execute on function public.push_payloads(uuid) to service_role;

create or replace function public.drop_push_endpoint(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;
revoke all on function public.drop_push_endpoint(text) from public, anon, authenticated;
grant execute on function public.drop_push_endpoint(text) to service_role;

-- - 4. Tell the Netlify function that a message was inserted (pg_net). The URL and token live in push_config, which only
--      the SQL editor can fill (see README): nothing secret is in the repository.
create table if not exists public.push_config (key text primary key, value text not null);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available: enable it in Database -> Extensions to get push notifications (%)', sqlerrm;
end $$;

create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare u text; t text;
begin
  select value into u from public.push_config where key = 'url';
  select value into t from public.push_config where key = 'token';
  if u is null or t is null then return null; end if;
  perform net.http_post(url := u || '?token=' || t, body := jsonb_build_object('message_id', new.id), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 3000);
  return null;
exception when others then
  return null; -- a push problem must never block a message
end;
$$;
revoke all on function public.notify_push() from public, anon, authenticated;

drop trigger if exists messages_notify_push on public.messages;
create trigger messages_notify_push after insert on public.messages for each row when (not new.is_internal) execute function public.notify_push();

revoke execute on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text), public.list_chats(uuid, uuid) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text), public.list_chats(uuid, uuid) to authenticated;

-- - 5. CRM: add a CIFRA account as a customer (by @username or phone search) and let the team see its photo.
create or replace function public.add_customer_from_user(p_business uuid, p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  p public.profiles;
  cid uuid;
begin
  if not public.is_business_agent(p_business) then raise exception 'forbidden'; end if;
  if p_user is null or p_user = me then raise exception 'invalid_peer'; end if;
  select * into p from public.profiles where id = p_user;
  if p.id is null then raise exception 'user_not_found'; end if;
  if exists (select 1 from public.business_members where business_id = p_business and user_id = p_user) then raise exception 'customer_is_team'; end if;
  perform public.check_rate('add_customer', 60, interval '1 hour');
  insert into public.customers (business_id, user_id, name, phone, created_by)
  values (p_business, p_user, p.display_name, case when p.hide_phone then null else p.phone end, me)
  on conflict (business_id, user_id) do nothing;
  select id into cid from public.customers where business_id = p_business and user_id = p_user;
  return cid;
end;
$$;

-- the team can read the profile card (name, photo, @username) of every person who is one of its customers, chat or not
drop function if exists public.get_profiles(uuid[]);
create or replace function public.get_profiles(p_ids uuid[])
returns table (id uuid, display_name text, avatar_path text, phone text, bio text, username text, created_at timestamptz, cover_path text)
language sql stable security definer set search_path = public as $q$
  select p.id, p.display_name, p.avatar_path,
         case when p.id = (select auth.uid()) or (public.shares_conversation_with(p.id) and not p.hide_phone) then p.phone end,
         p.bio, p.username, p.created_at, p.cover_path
  from public.profiles p
  where p.id = any (p_ids)
    and (p.id = (select auth.uid()) or public.shares_conversation_with(p.id) or public.shares_business_with(p.id)
         or exists (select 1 from public.conversation_members a join public.conversation_members b on a.conversation_id = b.conversation_id
                    where a.user_id = (select auth.uid()) and b.user_id = p.id)
         or exists (select 1 from public.customers cu where cu.user_id = p.id and public.is_business_member(cu.business_id)));
$q$;

revoke execute on function public.add_customer_from_user(uuid, uuid), public.get_profiles(uuid[]) from public, anon;
grant execute on function public.add_customer_from_user(uuid, uuid), public.get_profiles(uuid[]) to authenticated;
