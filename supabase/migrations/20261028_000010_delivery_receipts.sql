-- CIFRA v10: delivery receipts (one tick = sent, two grey ticks = delivered to the other device, two coloured = read).
-- Safe to re-run. Pure ASCII.

alter table public.conversation_members add column if not exists last_delivered_at timestamptz;
grant update (last_delivered_at) on public.conversation_members to authenticated;

-- reading implies delivery
create or replace function public.mark_read(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $q$
declare me uuid := (select auth.uid());
begin
  if me is null or not public.can_access_conversation(p_conv) then raise exception 'forbidden'; end if;
  insert into public.conversation_members (conversation_id, user_id, last_read_at, last_delivered_at)
  values (p_conv, me, now(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now(), last_delivered_at = now(), marked_unread = false;
end;
$q$;

-- the app calls this whenever it receives messages (list refresh, realtime insert, opening a chat): "it reached my device"
create or replace function public.mark_delivered(p_conv uuid default null)
returns integer language plpgsql security definer set search_path = public as $q$
declare me uuid := (select auth.uid()); n integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  update public.conversation_members cm
     set last_delivered_at = now()
   where cm.user_id = me
     and (p_conv is null or cm.conversation_id = p_conv)
     and exists (select 1 from public.messages m where m.conversation_id = cm.conversation_id and m.sender_id <> me
                   and m.created_at > coalesce(cm.last_delivered_at, cm.last_read_at, '-infinity'::timestamptz));
  get diagnostics n = row_count;
  return n;
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
  unread integer, muted_until timestamptz, pinned_at timestamptz, archived boolean, marked_unread boolean,
  incognito boolean, expires_at timestamptz, destroy_mine boolean, destroy_peer boolean,
  last_delivered boolean, last_read boolean
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
    (lm.sender_id = me and exists (select 1 from public.conversation_members o where o.conversation_id = c.id and o.user_id <> me and o.last_read_at >= lm.created_at))
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

revoke execute on all functions in schema public from public, anon;
grant execute on function public.mark_read(uuid), public.mark_delivered(uuid), public.list_chats(uuid, uuid) to authenticated;

-- - App releases: one row per deploy (inserted by netlify/functions/release.mts with the service role). The app listens
--   in realtime and shows "new version available" at once, instead of polling. Clients can only read.
create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  build text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.app_releases enable row level security;
revoke all on public.app_releases from anon, authenticated;
grant select on public.app_releases to authenticated;
drop policy if exists "releases: everyone reads" on public.app_releases;
create policy "releases: everyone reads" on public.app_releases for select to authenticated using (true);
do $$
begin
  execute 'alter publication supabase_realtime add table public.app_releases';
exception when duplicate_object then null;
end $$;
