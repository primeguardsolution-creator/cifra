-- CIFRA messaging layer: phone identity, 1:1 + group chats, business inbox, storage.
-- Run AFTER 20261021_000001_cifra_foundation.sql (Supabase Dashboard → SQL Editor → Run).
-- Safe to re-run.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Phone identity (one account per phone number)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists phone_verified boolean not null default false;
alter table public.profiles add column if not exists discoverable boolean not null default true;

alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles add constraint profiles_phone_format check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');
create unique index if not exists profiles_phone_unique on public.profiles (phone);

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
begin
  insert into public.profiles (id, display_name, phone, phone_verified)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Usuario CIFRA'), 120),
    case when v_phone is not null then '+' || v_phone end,
    new.phone_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_profile_phone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
begin
  update public.profiles
     set phone = case when v_phone is not null then '+' || v_phone end,
         phone_verified = new.phone_confirmed_at is not null
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_phone_changed on auth.users;
create trigger on_auth_user_phone_changed
  after update of phone, phone_confirmed_at on auth.users
  for each row
  when (old.phone is distinct from new.phone or old.phone_confirmed_at is distinct from new.phone_confirmed_at)
  execute function public.sync_profile_phone();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Schema additions
-- ───────────────────────────────────────────────────────────────────────────
alter table public.conversations add column if not exists direct_key text;
alter table public.conversations add column if not exists customer_id uuid references public.profiles(id) on delete cascade;
create unique index if not exists conversations_direct_key_unique on public.conversations (direct_key) where direct_key is not null;
create unique index if not exists conversations_business_customer_unique on public.conversations (business_id, customer_id) where kind = 'business';

alter table public.conversation_members add column if not exists is_admin boolean not null default false;

alter table public.messages add column if not exists is_internal boolean not null default false;
alter table public.messages add column if not exists is_automated boolean not null default false;
alter table public.messages add column if not exists attachment_name text;
alter table public.messages add column if not exists attachment_size bigint;

do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.messages'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%attachment_path IS NOT NULL%'
  loop
    execute format('alter table public.messages drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.messages drop constraint if exists messages_has_content;
alter table public.messages add constraint messages_has_content check (body is not null or attachment_path is not null or deleted_at is not null);

alter table public.businesses add column if not exists greeting text check (char_length(greeting) <= 1000);
alter table public.businesses add column if not exists away_message text check (char_length(away_message) <= 1000);
alter table public.businesses add column if not exists away_enabled boolean not null default false;
alter table public.businesses add column if not exists is_public boolean not null default true;
alter table public.businesses add column if not exists logo_path text;

create unique index if not exists contacts_owner_user_unique on public.contacts (owner_id, contact_user_id);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  shortcut text not null check (char_length(shortcut) between 1 and 32),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists quick_replies_business_idx on public.quick_replies (business_id);

create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('text', 'image')),
  body text check (char_length(body) <= 700),
  bg smallint not null default 0,
  media_path text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  check (body is not null or media_path is not null)
);
create index if not exists statuses_user_idx on public.statuses (user_id, created_at desc);

create table if not exists public.rate_events (
  user_id uuid not null,
  bucket text not null,
  at timestamptz not null default now()
);
create index if not exists rate_events_idx on public.rate_events (user_id, bucket, at);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Access helpers (SECURITY DEFINER, always keyed to auth.uid())
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.conversation_business(target_conversation_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select business_id from public.conversations where id = target_conversation_id;
$$;

create or replace function public.is_conversation_agent(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    join public.business_members bm on bm.business_id = c.business_id
    where c.id = target_conversation_id and bm.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_access_conversation(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_conversation_member(target_conversation_id) or public.is_conversation_agent(target_conversation_id);
$$;

create or replace function public.can_send_to_conversation(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_conversation(target_conversation_id)
    and not exists (
      select 1
      from public.conversations c
      join public.conversation_members m on m.conversation_id = c.id and m.user_id <> (select auth.uid())
      join public.user_blocks b on (b.blocker_id = (select auth.uid()) and b.blocked_id = m.user_id)
                               or (b.blocked_id = (select auth.uid()) and b.blocker_id = m.user_id)
      where c.id = target_conversation_id and c.kind = 'direct'
    );
$$;

create or replace function public.message_conversation(target_message_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select conversation_id from public.messages where id = target_message_id;
$$;

-- Direct/group contacts only (business conversations never expose personal data).
create or replace function public.shares_conversation_with(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.conversation_members a
    join public.conversation_members b on a.conversation_id = b.conversation_id
    join public.conversations c on c.id = a.conversation_id and c.kind in ('direct', 'group')
    where a.user_id = (select auth.uid()) and b.user_id = target
  );
$$;

create or replace function public.shares_business_with(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.kind = 'business'
      and ((c.customer_id = (select auth.uid()) and exists (select 1 from public.business_members bm where bm.business_id = c.business_id and bm.user_id = target))
        or (c.customer_id = target and public.is_business_member(c.business_id)))
  ) or exists (
    select 1 from public.business_members x
    join public.business_members y on x.business_id = y.business_id
    where x.user_id = (select auth.uid()) and y.user_id = target
  );
$$;

create or replace function public.check_rate(p_bucket text, p_max integer, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  n integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if random() < 0.02 then delete from public.rate_events where at < now() - interval '1 day'; end if;
  select count(*) into n from public.rate_events where user_id = me and bucket = p_bucket and at > now() - p_window;
  if n >= p_max then raise exception 'rate_limited'; end if;
  insert into public.rate_events (user_id, bucket) values (me, p_bucket);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Row-level security & privileges
-- ───────────────────────────────────────────────────────────────────────────
alter table public.message_reactions enable row level security;
alter table public.user_blocks enable row level security;
alter table public.quick_replies enable row level security;
alter table public.statuses enable row level security;
alter table public.rate_events enable row level security;

-- Tighten privileges: the client may only touch the columns it legitimately owns.
revoke all on public.rate_events from anon, authenticated;
revoke all on public.message_reactions, public.user_blocks, public.quick_replies, public.statuses from anon;
grant select, insert, update, delete on public.message_reactions, public.user_blocks, public.quick_replies, public.statuses to authenticated;

revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, username, bio, avatar_path, locale, timezone, discoverable) on public.profiles to authenticated;

revoke insert, update, delete on public.conversations from authenticated;
revoke insert, delete on public.conversation_members from authenticated;
revoke update on public.conversation_members from authenticated;
grant update (last_read_at, muted_until) on public.conversation_members to authenticated;

revoke insert, update, delete on public.business_members from authenticated;
revoke insert on public.businesses from authenticated;
revoke update on public.businesses from authenticated;
grant update (name, handle, description, category, email, phone, website, address, timezone, business_hours, greeting, away_message, away_enabled, is_public, logo_path) on public.businesses to authenticated;

revoke update on public.messages from authenticated;
revoke delete on public.messages from authenticated;
grant update (body, deleted_at) on public.messages to authenticated;

-- conversations / members: visible to participants and to business staff
drop policy if exists "conversations: member reads" on public.conversations;
drop policy if exists "conversations: creator creates" on public.conversations;
drop policy if exists "conversations: business manager updates" on public.conversations;
drop policy if exists "conversations: participants read" on public.conversations;
create policy "conversations: participants read" on public.conversations for select to authenticated using (public.can_access_conversation(id));

drop policy if exists "conversation members: member reads" on public.conversation_members;
drop policy if exists "conversation members: creator adds" on public.conversation_members;
drop policy if exists "conversation members: creator removes" on public.conversation_members;
drop policy if exists "conversation members: participants read" on public.conversation_members;
create policy "conversation members: participants read" on public.conversation_members for select to authenticated using (public.can_access_conversation(conversation_id));

-- messages
drop policy if exists "messages: member reads" on public.messages;
drop policy if exists "messages: member sends as self" on public.messages;
drop policy if exists "messages: sender edits" on public.messages;
drop policy if exists "messages: participants read" on public.messages;
drop policy if exists "messages: send as self" on public.messages;
drop policy if exists "messages: sender edits own" on public.messages;
create policy "messages: participants read" on public.messages for select to authenticated using (
  public.can_access_conversation(conversation_id) and (not is_internal or public.is_conversation_agent(conversation_id))
);
create policy "messages: send as self" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and not is_automated
  and public.can_send_to_conversation(conversation_id)
  and (not is_internal or public.is_conversation_agent(conversation_id))
);
create policy "messages: sender edits own" on public.messages for update to authenticated
  using (sender_id = (select auth.uid()) and not is_automated)
  with check (sender_id = (select auth.uid()));

create or replace function public.before_message_update()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.deleted_at is not null then
    return old;
  end if;
  if new.deleted_at is not null then
    new.body := null;
    new.attachment_path := null;
    new.attachment_type := null;
    new.attachment_name := null;
    new.attachment_size := null;
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists messages_before_update on public.messages;
create trigger messages_before_update before update on public.messages for each row execute function public.before_message_update();

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
       and (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id = c.customer_id and not m.is_internal) = 1 then
      insert into public.messages (conversation_id, sender_id, body, is_automated) values (c.id, b.owner_id, b.greeting, true);
    elsif b.away_enabled and coalesce(b.away_message, '') <> ''
       and not exists (select 1 from public.messages m where m.conversation_id = c.id and m.is_automated and m.body = b.away_message and m.created_at > now() - interval '12 hours') then
      insert into public.messages (conversation_id, sender_id, body, is_automated) values (c.id, b.owner_id, b.away_message, true);
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages for each row execute function public.after_message_insert();

-- reactions
drop policy if exists "reactions: read" on public.message_reactions;
drop policy if exists "reactions: add own" on public.message_reactions;
drop policy if exists "reactions: change own" on public.message_reactions;
drop policy if exists "reactions: remove own" on public.message_reactions;
create policy "reactions: read" on public.message_reactions for select to authenticated using (public.can_access_conversation(public.message_conversation(message_id)));
create policy "reactions: add own" on public.message_reactions for insert to authenticated with check (user_id = (select auth.uid()) and public.can_send_to_conversation(public.message_conversation(message_id)));
create policy "reactions: change own" on public.message_reactions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reactions: remove own" on public.message_reactions for delete to authenticated using (user_id = (select auth.uid()));

-- blocks
drop policy if exists "blocks: own" on public.user_blocks;
create policy "blocks: own" on public.user_blocks for all to authenticated using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- quick replies
drop policy if exists "quick replies: member reads" on public.quick_replies;
drop policy if exists "quick replies: manager writes" on public.quick_replies;
create policy "quick replies: member reads" on public.quick_replies for select to authenticated using (public.is_business_member(business_id));
create policy "quick replies: manager writes" on public.quick_replies for all to authenticated using (public.is_business_manager(business_id)) with check (public.is_business_manager(business_id));

-- statuses (24h stories, visible to people you chat with)
drop policy if exists "statuses: visible" on public.statuses;
drop policy if exists "statuses: post own" on public.statuses;
drop policy if exists "statuses: delete own" on public.statuses;
create policy "statuses: visible" on public.statuses for select to authenticated using (
  expires_at > now() and (user_id = (select auth.uid()) or public.shares_conversation_with(user_id))
);
create policy "statuses: post own" on public.statuses for insert to authenticated with check (user_id = (select auth.uid()));
create policy "statuses: delete own" on public.statuses for delete to authenticated using (user_id = (select auth.uid()));

-- published catalog is readable by anyone signed in (it is the shop window)
drop policy if exists "catalog: published is public" on public.catalog_items;
create policy "catalog: published is public" on public.catalog_items for select to authenticated using (is_published);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. RPCs (the only way to create conversations, businesses and teams)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.find_user_by_phone(p_phone text)
returns table (id uuid, display_name text, avatar_path text, phone text, is_self boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
  v text := '+' || regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if me is null then raise exception 'not_authenticated'; end if;
  perform public.check_rate('lookup', 40, interval '1 minute');
  return query
    select p.id, p.display_name, p.avatar_path, p.phone, p.id = me
    from public.profiles p
    where p.phone = v and (p.discoverable or p.id = me or public.shares_conversation_with(p.id));
end;
$$;

create or replace function public.get_profiles(p_ids uuid[])
returns table (id uuid, display_name text, avatar_path text, phone text, bio text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_path,
         case when p.id = (select auth.uid()) or public.shares_conversation_with(p.id) then p.phone end,
         p.bio
  from public.profiles p
  where p.id = any (p_ids)
    and (p.id = (select auth.uid()) or public.shares_conversation_with(p.id) or public.shares_business_with(p.id));
$$;

create or replace function public.start_direct_chat(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  k text;
  cid uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_other is null or p_other = me then raise exception 'invalid_peer'; end if;
  if not exists (select 1 from public.profiles where id = p_other) then raise exception 'user_not_found'; end if;
  k := least(me::text, p_other::text) || ':' || greatest(me::text, p_other::text);
  select id into cid from public.conversations where direct_key = k;
  if cid is null then
    insert into public.conversations (kind, created_by, direct_key) values ('direct', me, k)
      on conflict (direct_key) where direct_key is not null do nothing
      returning id into cid;
    if cid is null then
      select id into cid from public.conversations where direct_key = k;
    else
      insert into public.conversation_members (conversation_id, user_id) values (cid, me), (cid, p_other);
    end if;
  end if;
  return cid;
end;
$$;

create or replace function public.create_group(p_title text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  cid uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 120 then raise exception 'invalid_title'; end if;
  if coalesce(array_length(p_members, 1), 0) > 255 then raise exception 'too_many_members'; end if;
  insert into public.conversations (kind, created_by, title) values ('group', me, btrim(p_title)) returning id into cid;
  insert into public.conversation_members (conversation_id, user_id, is_admin) values (cid, me, true);
  insert into public.conversation_members (conversation_id, user_id)
    select cid, p.id from public.profiles p where p.id = any (coalesce(p_members, '{}')) and p.id <> me;
  return cid;
end;
$$;

create or replace function public.add_group_members(p_conv uuid, p_members uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if not exists (select 1 from public.conversation_members m join public.conversations c on c.id = m.conversation_id
                 where m.conversation_id = p_conv and m.user_id = me and m.is_admin and c.kind = 'group') then
    raise exception 'forbidden';
  end if;
  insert into public.conversation_members (conversation_id, user_id)
    select p_conv, p.id from public.profiles p where p.id = any (coalesce(p_members, '{}'))
    on conflict do nothing;
end;
$$;

create or replace function public.leave_conversation(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  delete from public.conversation_members m using public.conversations c
   where m.conversation_id = p_conv and m.user_id = me and c.id = m.conversation_id and c.kind = 'group';
end;
$$;

create or replace function public.mark_read(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if me is null or not public.can_access_conversation(p_conv) then raise exception 'forbidden'; end if;
  insert into public.conversation_members (conversation_id, user_id, last_read_at)
  values (p_conv, me, now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

create or replace function public.list_chats(p_business uuid default null, p_conv uuid default null)
returns table (
  id uuid, kind public.conversation_kind, title text, state public.conversation_state,
  business_id uuid, assigned_to uuid, perspective text, created_at timestamptz,
  peer_id uuid, peer_name text, peer_avatar text, peer_phone text,
  business_name text, business_handle text, member_count integer,
  last_message_id uuid, last_body text, last_sender uuid, last_attachment_type text,
  last_deleted boolean, last_internal boolean, last_at timestamptz,
  unread integer, muted_until timestamptz
)
language plpgsql stable security definer set search_path = public as $$
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
    case when c.kind = 'direct' or v.perspective = 'agent' then peer.phone end,
    b.name, b.handle,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    lm.id, lm.body, lm.sender_id, lm.attachment_type, (lm.deleted_at is not null), lm.is_internal, lm.created_at,
    (select count(*)::int from public.messages m
      where m.conversation_id = c.id and m.deleted_at is null and not m.is_internal and m.sender_id <> me
        and m.created_at > coalesce(cm.last_read_at, '-infinity'::timestamptz)
        and (v.perspective <> 'agent' or m.sender_id = c.customer_id)),
    cm.muted_until
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
  order by coalesce(lm.created_at, c.created_at) desc;
end;
$$;

-- Business -------------------------------------------------------------------
create or replace function public.create_business(p_name text, p_handle text, p_category text, p_description text, p_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  bid uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  perform public.check_rate('create_business', 5, interval '1 day');
  insert into public.businesses (owner_id, name, handle, category, description, phone)
  values (me, btrim(p_name), nullif(lower(btrim(coalesce(p_handle, ''))), ''), nullif(btrim(coalesce(p_category, '')), ''), nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_phone, '')), ''))
  returning id into bid;
  return bid;
end;
$$;

drop function if exists public.search_businesses(text);
create or replace function public.search_businesses(p_query text)
returns table (id uuid, name text, handle text, category text, description text, logo_path text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare q text := btrim(coalesce(p_query, ''));
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if char_length(q) < 2 then return; end if;
  perform public.check_rate('search_business', 40, interval '1 minute');
  return query
    select b.id, b.name, b.handle, b.category, b.description, b.logo_path
    from public.businesses b
    where b.is_public and (b.name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%' or b.handle ilike replace(replace(q, '%', ''), '_', '') || '%')
    order by b.name limit 20;
end;
$$;

create or replace function public.get_business_public(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'handle', b.handle, 'category', b.category, 'description', b.description, 'logo_path', b.logo_path,
    'phone', b.phone, 'email', b.email, 'website', b.website, 'address', b.address,
    'catalog', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description, 'price_minor', i.price_minor, 'currency', i.currency, 'image_path', i.image_path) order by i.created_at)
                         from public.catalog_items i where i.business_id = b.id and i.is_published), '[]'::jsonb)
  ) into r
  from public.businesses b
  where b.id = p_id and (b.is_public or public.is_business_member(b.id));
  return r;
end;
$$;

create or replace function public.start_business_chat(p_business uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  cid uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.businesses where id = p_business and is_public) then raise exception 'business_not_found'; end if;
  if public.is_business_member(p_business) then raise exception 'own_business'; end if;
  select id into cid from public.conversations where business_id = p_business and customer_id = me and kind = 'business';
  if cid is null then
    insert into public.conversations (kind, created_by, business_id, customer_id) values ('business', me, p_business, me)
      on conflict (business_id, customer_id) where kind = 'business' do nothing
      returning id into cid;
    if cid is null then
      select id into cid from public.conversations where business_id = p_business and customer_id = me and kind = 'business';
    else
      insert into public.conversation_members (conversation_id, user_id) values (cid, me);
    end if;
  end if;
  return cid;
end;
$$;

create or replace function public.update_business_conversation(p_conv uuid, p_state public.conversation_state default null, p_assigned uuid default null, p_unassign boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare bid uuid := public.conversation_business(p_conv);
begin
  if bid is null or not public.is_business_member(bid) then raise exception 'forbidden'; end if;
  if p_assigned is not null and not exists (select 1 from public.business_members where business_id = bid and user_id = p_assigned) then
    raise exception 'assignee_not_in_team';
  end if;
  update public.conversations
     set state = coalesce(p_state, state),
         assigned_to = case when p_unassign then null else coalesce(p_assigned, assigned_to) end
   where id = p_conv;
end;
$$;

create or replace function public.role_rank(r public.business_role)
returns integer language sql immutable as $$
  select case r when 'owner' then 5 when 'admin' then 4 when 'supervisor' then 3 when 'agent' then 2 else 1 end;
$$;

create or replace function public.list_business_team(p_business uuid)
returns table (user_id uuid, role public.business_role, display_name text, avatar_path text, phone text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_business_member(p_business) then raise exception 'forbidden'; end if;
  return query
    select bm.user_id, bm.role, p.display_name, p.avatar_path, p.phone, bm.joined_at
    from public.business_members bm join public.profiles p on p.id = bm.user_id
    where bm.business_id = p_business
    order by public.role_rank(bm.role) desc, p.display_name;
end;
$$;

create or replace function public.add_business_member(p_business uuid, p_phone text, p_role public.business_role)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  my_role public.business_role;
  target uuid;
begin
  select role into my_role from public.business_members where business_id = p_business and user_id = me;
  if my_role is null or public.role_rank(my_role) < 3 then raise exception 'forbidden'; end if;
  if p_role = 'owner' or public.role_rank(p_role) >= public.role_rank(my_role) and my_role <> 'owner' then raise exception 'forbidden_role'; end if;
  perform public.check_rate('add_member', 30, interval '1 day');
  select id into target from public.profiles where phone = '+' || regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if target is null then raise exception 'user_not_found'; end if;
  insert into public.business_members (business_id, user_id, role, invited_by)
  values (p_business, target, p_role, me)
  on conflict (business_id, user_id) do nothing;
  return target;
end;
$$;

create or replace function public.set_business_member_role(p_business uuid, p_user uuid, p_role public.business_role)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  my_role public.business_role;
  their_role public.business_role;
begin
  select role into my_role from public.business_members where business_id = p_business and user_id = me;
  select role into their_role from public.business_members where business_id = p_business and user_id = p_user;
  if my_role is null or their_role is null or public.role_rank(my_role) < 3 then raise exception 'forbidden'; end if;
  if their_role = 'owner' or p_role = 'owner' then raise exception 'forbidden_role'; end if;
  if my_role <> 'owner' and (public.role_rank(their_role) >= public.role_rank(my_role) or public.role_rank(p_role) >= public.role_rank(my_role)) then
    raise exception 'forbidden_role';
  end if;
  update public.business_members set role = p_role where business_id = p_business and user_id = p_user;
end;
$$;

create or replace function public.remove_business_member(p_business uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  my_role public.business_role;
  their_role public.business_role;
begin
  select role into my_role from public.business_members where business_id = p_business and user_id = me;
  select role into their_role from public.business_members where business_id = p_business and user_id = p_user;
  if my_role is null or their_role is null or their_role = 'owner' then raise exception 'forbidden'; end if;
  if p_user <> me and (public.role_rank(my_role) < 3 or (my_role <> 'owner' and public.role_rank(their_role) >= public.role_rank(my_role))) then
    raise exception 'forbidden';
  end if;
  delete from public.business_members where business_id = p_business and user_id = p_user;
  update public.conversations set assigned_to = null where business_id = p_business and assigned_to = p_user;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Storage (private chat media, public avatars)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.storage_can_read(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  parts text[] := string_to_array(p_name, '/');
  me text := (select auth.uid())::text;
begin
  if me is null or array_length(parts, 1) < 2 then return false; end if;
  if parts[1] = 'status' then
    return parts[2] = me or (parts[2] ~ '^[0-9a-f-]{36}$' and public.shares_conversation_with(parts[2]::uuid));
  end if;
  return parts[1] ~ '^[0-9a-f-]{36}$' and public.can_access_conversation(parts[1]::uuid);
end;
$$;

create or replace function public.storage_can_write(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  parts text[] := string_to_array(p_name, '/');
  me text := (select auth.uid())::text;
begin
  if me is null or array_length(parts, 1) < 2 then return false; end if;
  if parts[1] = 'status' then return parts[2] = me; end if;
  return parts[1] ~ '^[0-9a-f-]{36}$' and public.can_send_to_conversation(parts[1]::uuid);
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('chat-media', 'chat-media', false, 26214400,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm',
         'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'application/pdf', 'text/plain']),
  ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat media: read" on storage.objects;
drop policy if exists "chat media: upload" on storage.objects;
drop policy if exists "chat media: delete own" on storage.objects;
create policy "chat media: read" on storage.objects for select to authenticated using (bucket_id = 'chat-media' and public.storage_can_read(name));
create policy "chat media: upload" on storage.objects for insert to authenticated with check (bucket_id = 'chat-media' and public.storage_can_write(name));
create policy "chat media: delete own" on storage.objects for delete to authenticated using (bucket_id = 'chat-media' and owner_id = (select auth.uid())::text);

create or replace function public.avatar_can_write(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  parts text[] := string_to_array(p_name, '/');
  me text := (select auth.uid())::text;
begin
  if me is null or array_length(parts, 1) < 2 then return false; end if;
  if parts[1] = 'business' then
    return parts[2] ~ '^[0-9a-f-]{36}$' and public.is_business_manager(parts[2]::uuid);
  end if;
  return parts[1] = me;
end;
$$;

drop policy if exists "avatars: own folder insert" on storage.objects;
drop policy if exists "avatars: own folder update" on storage.objects;
drop policy if exists "avatars: own folder delete" on storage.objects;
drop policy if exists "avatars: writable folder insert" on storage.objects;
drop policy if exists "avatars: writable folder update" on storage.objects;
drop policy if exists "avatars: writable folder delete" on storage.objects;
create policy "avatars: writable folder insert" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and public.avatar_can_write(name));
create policy "avatars: writable folder update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and public.avatar_can_write(name));
create policy "avatars: writable folder delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and public.avatar_can_write(name));

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Function privileges & realtime
-- ───────────────────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

do $$
declare t text;
begin
  foreach t in array array['messages', 'conversation_members', 'message_reactions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
