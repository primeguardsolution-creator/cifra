-- Migration 20: calls for Business. (1) Call signalling also works between a business team and its customers and between team mates, and
-- supports group calls and screen sharing (events join / leave / media). (2) A customer calling a business reaches the assigned agent, or the
-- whole team when nobody is assigned. (3) Negotiation rooms: a private group chat that gathers one customer and several team members, with
-- files, polls and group calls, linked to the customer's CRM card. Safe to re-run.
create or replace function public.send_call_signal(p_to uuid, p_event text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_to is null or p_to = me then raise exception 'invalid_peer'; end if;
  if p_event not in ('invite', 'accept', 'offer', 'answer', 'ice', 'decline', 'busy', 'cancel', 'end', 'join', 'leave', 'media') then raise exception 'invalid_event'; end if;
  if octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 65536 then raise exception 'payload_too_large'; end if;
  if not (public.shares_conversation_with(p_to) or public.shares_business_with(p_to)) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id = me and b.blocked_id = p_to) or (b.blocker_id = p_to and b.blocked_id = me)) then
    raise exception 'forbidden';
  end if;
  perform public.check_rate('call_signal', 900, interval '1 minute');
  perform realtime.send(coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('from', me), p_event, 'call:' || p_to::text, true);
end;
$$;

-- who answers when a customer calls the business from a conversation: the assigned agent, or every agent
create or replace function public.business_call_targets(p_conv uuid)
returns table (user_id uuid, display_name text, avatar_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_path
  from public.conversations c
  join public.business_members bm on bm.business_id = c.business_id and bm.role in ('owner', 'admin', 'supervisor', 'agent')
  join public.profiles p on p.id = bm.user_id
  where c.id = p_conv and c.kind = 'business' and c.customer_id = (select auth.uid())
    and (c.assigned_to is null or bm.user_id = c.assigned_to)
    and not exists (select 1 from public.user_blocks b where (b.blocker_id = p.id and b.blocked_id = c.customer_id) or (b.blocker_id = c.customer_id and b.blocked_id = p.id))
  limit 12;
$$;

create table if not exists public.negotiation_rooms (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists negotiation_rooms_business_idx on public.negotiation_rooms (business_id, customer_id);
alter table public.negotiation_rooms enable row level security;
revoke all on public.negotiation_rooms from anon, authenticated;

-- opens (or reuses) the negotiation room of a customer and adds the given team members; the customer must have a CIFRA account
create or replace function public.start_negotiation(p_business uuid, p_customer uuid, p_members uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  cu public.customers;
  bn text;
  cid uuid;
begin
  if not public.is_business_agent(p_business) then raise exception 'forbidden'; end if;
  select * into cu from public.customers where id = p_customer and business_id = p_business;
  if cu.id is null then raise exception 'customer_not_found'; end if;
  if cu.user_id is null then raise exception 'customer_without_account'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id = cu.user_id and b.blocked_id = me) or (b.blocker_id = me and b.blocked_id = cu.user_id)) then raise exception 'forbidden'; end if;
  perform public.check_rate('negotiation', 30, interval '1 hour');
  select conversation_id into cid from public.negotiation_rooms where business_id = p_business and customer_id = p_customer limit 1;
  if cid is null then
    select name into bn from public.businesses where id = p_business;
    insert into public.conversations (kind, created_by, title) values ('group', me, left('Negociaci' || chr(243) || 'n ' || chr(183) || ' ' || bn || ' ' || chr(183) || ' ' || cu.name, 120)) returning id into cid;
    insert into public.conversation_members (conversation_id, user_id, is_admin) values (cid, me, true);
    insert into public.conversation_members (conversation_id, user_id) values (cid, cu.user_id) on conflict do nothing;
    insert into public.negotiation_rooms (conversation_id, business_id, customer_id, created_by) values (cid, p_business, p_customer, me);
    insert into public.messages (conversation_id, sender_id, body, is_automated) values (cid, me, chr(129309) || ' Sala de negociaci' || chr(243) || 'n. Aqu' || chr(237) || ' puedes compartir archivos, hacer encuestas y llamar en grupo.', true);
  end if;
  insert into public.conversation_members (conversation_id, user_id)
    select cid, bm.user_id from public.business_members bm where bm.business_id = p_business and bm.user_id = any (coalesce(p_members, '{}')) and bm.user_id <> me
    on conflict do nothing;
  return cid;
end;
$$;

create or replace function public.list_negotiations(p_business uuid)
returns table (conversation_id uuid, customer_id uuid, customer_name text, members integer, created_at timestamptz, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.conversation_id, r.customer_id, cu.name,
         (select count(*)::integer from public.conversation_members m where m.conversation_id = r.conversation_id), r.created_at,
         (select max(x.created_at) from public.messages x where x.conversation_id = r.conversation_id)
  from public.negotiation_rooms r join public.customers cu on cu.id = r.customer_id
  where r.business_id = p_business and public.is_business_member(p_business)
    and exists (select 1 from public.conversation_members mm where mm.conversation_id = r.conversation_id and mm.user_id = (select auth.uid()))
  order by coalesce((select max(x.created_at) from public.messages x where x.conversation_id = r.conversation_id), r.created_at) desc;
$$;

revoke execute on function public.send_call_signal(uuid, text, jsonb), public.business_call_targets(uuid), public.start_negotiation(uuid, uuid, uuid[]), public.list_negotiations(uuid) from public, anon;
grant execute on function public.send_call_signal(uuid, text, jsonb), public.business_call_targets(uuid), public.start_negotiation(uuid, uuid, uuid[]), public.list_negotiations(uuid) to authenticated;
