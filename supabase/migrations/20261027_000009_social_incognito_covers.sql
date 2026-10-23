-- CIFRA v9: appointment invitations for any user, @username search, chats started from the CRM, business posts
-- (statuses with video + a public feed per business), cover photos, incognito self-destructing chats, a colour per
-- business and reports of unknown contacts. Safe to re-run. Pure ASCII: non-ASCII characters are built with chr().

-- - 1. Covers (people and businesses) + the colour of each business -
alter table public.profiles add column if not exists cover_path text;
grant update (cover_path) on public.profiles to authenticated;

alter table public.businesses add column if not exists cover_path text;
alter table public.businesses add column if not exists accent text not null default 'amber';
alter table public.businesses drop constraint if exists businesses_accent_check;
alter table public.businesses add constraint businesses_accent_check check (accent in ('amber', 'cobalt', 'jade', 'ruby', 'orchid'));
grant update (cover_path, accent) on public.businesses to authenticated;

-- - 2. Incognito chats: a named 1:1 room that destroys itself after 3 h of silence, or at once when both ask -
alter table public.conversations add column if not exists incognito boolean not null default false;
alter table public.conversations add column if not exists expires_at timestamptz;
alter table public.conversation_members add column if not exists destroy_requested_at timestamptz;
create index if not exists conversations_incognito_expires_idx on public.conversations (expires_at) where incognito;

-- Incognito rooms never count as "sharing a conversation": they must not unlock phone numbers, statuses or profiles.
create or replace function public.shares_conversation_with(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.conversation_members a
    join public.conversation_members b on a.conversation_id = b.conversation_id
    join public.conversations c on c.id = a.conversation_id and c.kind in ('direct', 'group') and not c.incognito
    where a.user_id = (select auth.uid()) and b.user_id = target
  );
$$;

create or replace function public.incognito_notice()
returns text language sql immutable as $$
  -- "Chat incognito. Se autodestruye tras 3 horas sin actividad o en cuanto ambos lo pidan."
  select 'Chat inc' || chr(243) || 'gnito. Se autodestruye tras 3 horas sin actividad o en cuanto ambos lo pidan.';
$$;

create or replace function public.start_incognito_chat(p_other uuid, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  cid uuid;
  title text := left(btrim(coalesce(p_title, '')), 60);
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_other is null or p_other = me then raise exception 'invalid_peer'; end if;
  if not exists (select 1 from public.profiles where id = p_other) then raise exception 'user_not_found'; end if;
  if exists (select 1 from public.user_blocks where (blocker_id = me and blocked_id = p_other) or (blocker_id = p_other and blocked_id = me)) then raise exception 'blocked'; end if;
  if title = '' then title := 'Inc' || chr(243) || 'gnito'; end if;
  perform public.check_rate('incognito', 20, interval '1 hour');
  insert into public.conversations (kind, created_by, title, incognito, expires_at) values ('direct', me, title, true, now() + interval '3 hours') returning id into cid;
  insert into public.conversation_members (conversation_id, user_id) values (cid, me), (cid, p_other);
  insert into public.messages (conversation_id, sender_id, body, is_automated) values (cid, me, public.incognito_notice(), true);
  return cid;
end;
$$;

-- any message keeps the room alive for another 3 hours
create or replace function public.touch_incognito()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set expires_at = now() + interval '3 hours' where id = new.conversation_id and incognito;
  return new;
end;
$$;
drop trigger if exists messages_touch_incognito on public.messages;
create trigger messages_touch_incognito after insert on public.messages for each row execute function public.touch_incognito();

-- internal: wipes a conversation and everything hanging from it (messages, reactions, stars, scheduled, media rows)
create or replace function public.destroy_conversation(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  begin
    delete from storage.objects where bucket_id = 'chat-media' and name like p_conv::text || '/%';
  exception when others then null; -- storage may be unavailable (tests); the bucket is cleaned by the client too
  end;
  delete from public.conversations where id = p_conv;
end;
$$;

-- "destroy now": the room disappears the moment both members have asked for it
create or replace function public.request_incognito_destroy(p_conv uuid, p_cancel boolean default false)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if me is null or not public.is_conversation_member(p_conv) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.conversations where id = p_conv and incognito) then raise exception 'not_incognito'; end if;
  update public.conversation_members set destroy_requested_at = case when p_cancel then null else coalesce(destroy_requested_at, now()) end
   where conversation_id = p_conv and user_id = me;
  if not p_cancel and not exists (select 1 from public.conversation_members where conversation_id = p_conv and destroy_requested_at is null) then
    perform public.destroy_conversation(p_conv);
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.purge_incognito()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  for r in select id from public.conversations where incognito and expires_at < now() loop
    perform public.destroy_conversation(r.id); n := n + 1;
  end loop;
  return n;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'cifra-purge-incognito';
    perform cron.schedule('cifra-purge-incognito', '*/5 * * * *', 'select public.purge_incognito()');
  end if;
exception when others then
  raise notice 'pg_cron not enabled: incognito chats are hidden when they expire and purged on the next run (%)', sqlerrm;
end $$;

-- - 3. Chat list: incognito flags, no phone leak inside incognito rooms, expired rooms hidden -
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
  incognito boolean, expires_at timestamptz, destroy_mine boolean, destroy_peer boolean
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
    exists (select 1 from public.conversation_members o where o.conversation_id = c.id and o.user_id <> me and o.destroy_requested_at is not null)
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
    and not (c.incognito and c.expires_at < now())
    and case
          when p_conv is not null then public.can_access_conversation(c.id)
          when p_business is null then cm.user_id is not null and (c.kind <> 'business' or c.customer_id = me)
          else c.kind = 'business' and c.business_id = p_business
        end
  order by cm.pinned_at desc nulls last, coalesce(lm.created_at, c.created_at) desc;
end;
$q$;

-- - 4. Profiles: covers travel with the profile card; the public business page gets cover + colour -
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
                    where a.user_id = (select auth.uid()) and b.user_id = p.id));
$q$;

create or replace function public.get_business_public(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'handle', b.handle, 'category', b.category, 'description', b.description, 'logo_path', b.logo_path,
    'cover_path', b.cover_path, 'accent', b.accent,
    'phone', case when b.show_phone or public.is_business_member(b.id) then b.phone end, 'show_phone', b.show_phone,
    'email', b.email, 'website', b.website, 'address', b.address,
    'catalog', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description, 'price_minor', i.price_minor, 'currency', i.currency, 'image_path', i.image_path) order by i.created_at)
                         from public.catalog_items i where i.business_id = b.id and i.is_published), '[]'::jsonb)
  ) into r
  from public.businesses b
  where b.id = p_id and (b.is_public or public.is_business_member(b.id));
  return r;
end;
$$;

-- - 5. People search by @username (prefix), so an account is found as soon as it exists -
create or replace function public.search_users(p_query text)
returns table (id uuid, display_name text, username text, avatar_path text, is_self boolean, is_contact boolean)
language plpgsql security definer set search_path = public as $q$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
  q text := lower(regexp_replace(btrim(coalesce(p_query, '')), '^@', ''));
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if q !~ '^[a-z0-9_]{2,32}$' then return; end if;
  perform public.check_rate('lookup', 40, interval '1 minute');
  return query
    select p.id, p.display_name, p.username, p.avatar_path, p.id = me,
           exists (select 1 from public.contacts k where k.owner_id = me and k.contact_user_id = p.id)
    from public.profiles p
    where p.username is not null and p.username like q || '%'
    order by (p.username = q) desc, p.username
    limit 8;
end;
$q$;

-- - 6. CRM: write to a customer from the Clients screen (creates the business chat on demand) -
create or replace function public.start_customer_chat(p_customer uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  cu public.customers;
  uid uuid;
  digits text;
begin
  select * into cu from public.customers where id = p_customer;
  if cu.id is null or not public.is_business_agent(cu.business_id) then raise exception 'forbidden'; end if;
  uid := cu.user_id;
  if uid is null then
    digits := regexp_replace(coalesce(cu.phone, ''), '[^0-9]', '', 'g');
    if digits = '' then raise exception 'customer_not_on_cifra'; end if;
    select p.id into uid from public.profiles p where p.phone = '+' || digits and p.discoverable;
    if uid is null then raise exception 'customer_not_on_cifra'; end if;
    if exists (select 1 from public.customers x where x.business_id = cu.business_id and x.user_id = uid) then raise exception 'customer_duplicate'; end if;
    update public.customers set user_id = uid where id = cu.id;
  end if;
  if exists (select 1 from public.business_members where business_id = cu.business_id and user_id = uid) then raise exception 'customer_is_team'; end if;
  return public.ensure_business_conversation(cu.business_id, uid);
end;
$$;

-- - 7. Appointments: invite any CIFRA user (business or not); the invitee accepts from the card -
drop function if exists public.create_appointment(uuid, uuid, text, timestamptz, timestamptz, text, uuid);
create or replace function public.create_appointment(p_business uuid, p_customer uuid, p_title text, p_start timestamptz, p_end timestamptz, p_notes text default null, p_assigned uuid default null, p_user uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  cu public.customers;
  cid uuid;
  aid uuid;
  cust uuid := p_customer;
  nm text;
begin
  if not public.is_business_agent(p_business) then raise exception 'forbidden'; end if;
  if p_end <= p_start then raise exception 'invalid_range'; end if;
  if p_assigned is not null and not exists (select 1 from public.business_members where business_id = p_business and user_id = p_assigned) then raise exception 'assignee_not_in_team'; end if;
  if p_assigned is not null and exists (select 1 from public.appointments a where a.business_id = p_business and a.assigned_to = p_assigned and a.status in ('scheduled', 'confirmed') and a.starts_at < p_end and a.ends_at > p_start) then
    raise exception 'appointment_overlap';
  end if;
  perform public.check_rate('create_appointment', 120, interval '1 hour');
  if p_user is not null then
    if p_user = me then raise exception 'invalid_peer'; end if;
    if not exists (select 1 from public.profiles where id = p_user) then raise exception 'user_not_found'; end if;
    if exists (select 1 from public.business_members where business_id = p_business and user_id = p_user) then raise exception 'customer_is_team'; end if;
    select display_name into nm from public.profiles where id = p_user;
    insert into public.customers (business_id, user_id, name, created_by) values (p_business, p_user, coalesce(nm, 'Cliente'), me) on conflict (business_id, user_id) do nothing;
    select id into cust from public.customers where business_id = p_business and user_id = p_user;
  end if;
  if cust is not null then
    select * into cu from public.customers where id = cust and business_id = p_business;
    if cu.id is null then raise exception 'customer_not_found'; end if;
    if cu.user_id is not null then cid := public.ensure_business_conversation(p_business, cu.user_id); end if;
  end if;
  insert into public.appointments (business_id, customer_id, customer_user_id, conversation_id, title, notes, starts_at, ends_at, status, assigned_to, created_by)
  values (p_business, cust, cu.user_id, cid, btrim(p_title), nullif(btrim(coalesce(p_notes, '')), ''), p_start, p_end, 'scheduled', p_assigned, me)
  returning id into aid;
  if cid is not null then
    -- "Invitacion a cita": the invitee accepts or declines from the card in the chat
    insert into public.messages (conversation_id, sender_id, body) values (cid, me, public.appointment_card(btrim(p_title), p_start, 'Invitaci' || chr(243) || 'n a cita', aid));
  end if;
  return aid;
end;
$$;

drop function if exists public.my_appointments();
create or replace function public.my_appointments()
returns table (id uuid, business_id uuid, business_name text, logo_path text, title text, starts_at timestamptz, ends_at timestamptz, status text, notes text, conversation_id uuid, business_handle text)
language sql stable security definer set search_path = public as $$
  select a.id, a.business_id, b.name, b.logo_path, a.title, a.starts_at, a.ends_at, a.status, a.notes, a.conversation_id, b.handle
  from public.appointments a join public.businesses b on b.id = a.business_id
  where a.customer_user_id = (select auth.uid()) and a.status <> 'cancelled' and a.ends_at > now() - interval '1 day'
  order by a.starts_at limit 100;
$$;

-- - 8. Posts: statuses can be videos, and a business can publish to a public feed (7 days) -
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'public.statuses'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%' loop
    execute format('alter table public.statuses drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.statuses add constraint statuses_kind_check check (kind in ('text', 'image', 'video'));
alter table public.statuses add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.statuses drop constraint if exists statuses_expiry_check;
alter table public.statuses add constraint statuses_expiry_check check (expires_at <= created_at + interval '7 days');
create index if not exists statuses_business_idx on public.statuses (business_id, created_at desc) where business_id is not null;
grant insert (user_id, kind, body, bg, media_path, business_id, expires_at) on public.statuses to authenticated;

drop policy if exists "statuses: visible" on public.statuses;
create policy "statuses: visible" on public.statuses for select to authenticated using (
  expires_at > now() and (
    user_id = (select auth.uid())
    or (business_id is null and public.shares_conversation_with(user_id))
    or (business_id is not null and (public.is_business_member(business_id) or exists (select 1 from public.businesses b where b.id = business_id and b.is_public)))
  )
);
drop policy if exists "statuses: post own" on public.statuses;
create policy "statuses: post own" on public.statuses for insert to authenticated with check (
  user_id = (select auth.uid()) and (business_id is null or public.is_business_agent(business_id))
);
drop policy if exists "statuses: delete own" on public.statuses;
create policy "statuses: delete own" on public.statuses for delete to authenticated using (
  user_id = (select auth.uid()) or (business_id is not null and public.is_business_manager(business_id))
);

-- media for business posts lives in status/biz/<business_id>/...
create or replace function public.storage_can_read(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  parts text[] := string_to_array(p_name, '/');
  me text := (select auth.uid())::text;
begin
  if me is null or array_length(parts, 1) < 2 then return false; end if;
  if parts[1] = 'status' then
    if parts[2] = 'biz' then
      return array_length(parts, 1) >= 3 and parts[3] ~ '^[0-9a-f-]{36}$'
         and (public.is_business_member(parts[3]::uuid) or exists (select 1 from public.businesses b where b.id = parts[3]::uuid and b.is_public));
    end if;
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
  if parts[1] = 'status' then
    if parts[2] = 'biz' then return array_length(parts, 1) >= 3 and parts[3] ~ '^[0-9a-f-]{36}$' and public.is_business_agent(parts[3]::uuid); end if;
    return parts[2] = me;
  end if;
  return parts[1] ~ '^[0-9a-f-]{36}$' and public.can_send_to_conversation(parts[1]::uuid);
end;
$$;

-- - 9. Reports: "this unknown contact wrote to me" -
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid references public.profiles(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  conversation_id uuid,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (reporter_id, reported_id, business_id, conversation_id, reason) on public.reports to authenticated;
drop policy if exists "reports: own" on public.reports;
create policy "reports: own" on public.reports for select to authenticated using (reporter_id = (select auth.uid()));
drop policy if exists "reports: file own" on public.reports;
create policy "reports: file own" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()) and reporter_id is distinct from reported_id);

-- - 10. Grants -
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.destroy_conversation(uuid), public.purge_incognito(), public.touch_incognito(), public.ensure_business_conversation(uuid, uuid) from authenticated;
grant execute on function public.shares_conversation_with(uuid), public.incognito_notice(), public.start_incognito_chat(uuid, text), public.request_incognito_destroy(uuid, boolean),
  public.list_chats(uuid, uuid), public.get_profiles(uuid[]), public.get_business_public(uuid), public.search_users(text), public.start_customer_chat(uuid),
  public.create_appointment(uuid, uuid, text, timestamptz, timestamptz, text, uuid, uuid), public.my_appointments(),
  public.storage_can_read(text), public.storage_can_write(text) to authenticated;
