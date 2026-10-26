-- Migration 16: broadcasts ("Difusion"). A business manager (owner, admin, supervisor) sends one message to the customers who have a CIFRA
-- account; each one gets it in their normal chat with the business, marked as a broadcast, with a one-tap "stop receiving these".
-- Limits: 3 broadcasts per business per 24 h, 500 recipients each. Customers who opted out, blocked someone or are team members never receive it. Safe to re-run.
alter table public.messages add column if not exists is_broadcast boolean not null default false;

create table if not exists public.broadcast_optouts (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sent_by uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  segment_stage text,
  segment_tag text,
  recipients integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists broadcasts_business_idx on public.broadcasts (business_id, created_at desc);
alter table public.broadcast_optouts enable row level security;
alter table public.broadcasts enable row level security;
revoke all on public.broadcast_optouts, public.broadcasts from anon, authenticated;

-- customers of this business with an account who can receive a broadcast from the caller
create or replace function public.broadcast_targets(p_business uuid, p_stage text, p_tag text)
returns table (customer_id uuid, user_id uuid)
language sql stable security definer set search_path = public as $$
  select c.id, c.user_id
  from public.customers c
  where c.business_id = p_business and c.user_id is not null
    and (p_stage is null or c.stage = p_stage)
    and (p_tag is null or p_tag = any (c.tags))
    and not exists (select 1 from public.business_members m where m.business_id = p_business and m.user_id = c.user_id)
    and not exists (select 1 from public.broadcast_optouts o where o.business_id = p_business and o.user_id = c.user_id)
    and not exists (select 1 from public.user_blocks b where (b.blocker_id = c.user_id and b.blocked_id = (select auth.uid())) or (b.blocker_id = (select auth.uid()) and b.blocked_id = c.user_id))
  order by c.created_at
  limit 500;
$$;
revoke execute on function public.broadcast_targets(uuid, text, text) from public, anon, authenticated;

-- how many people the segment has, and how many of them can receive it
create or replace function public.broadcast_audience(p_business uuid, p_stage text default null, p_tag text default null)
returns table (total integer, reachable integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_business_manager(p_business) then raise exception 'forbidden'; end if;
  return query select
    (select count(*)::integer from public.customers c where c.business_id = p_business and (p_stage is null or c.stage = p_stage) and (p_tag is null or p_tag = any (c.tags))),
    (select count(*)::integer from public.broadcast_targets(p_business, p_stage, p_tag));
end;
$$;

create or replace function public.send_broadcast(p_business uuid, p_body text, p_stage text default null, p_tag text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  txt text := btrim(coalesce(p_body, ''));
  t record; cid uuid; n integer := 0; bid uuid;
begin
  if not public.is_business_manager(p_business) then raise exception 'forbidden'; end if;
  if char_length(txt) < 1 or char_length(txt) > 1000 then raise exception 'invalid_body'; end if;
  if (select count(*) from public.broadcasts b where b.business_id = p_business and b.created_at > now() - interval '24 hours') >= 3 then raise exception 'broadcast_limit'; end if;
  perform public.check_rate('send_broadcast', 20, interval '1 hour');
  insert into public.broadcasts (business_id, sent_by, body, segment_stage, segment_tag) values (p_business, me, txt, p_stage, nullif(btrim(coalesce(p_tag, '')), '')) returning id into bid;
  for t in select * from public.broadcast_targets(p_business, p_stage, nullif(btrim(coalesce(p_tag, '')), '')) loop
    cid := public.ensure_business_conversation(p_business, t.user_id);
    insert into public.messages (conversation_id, sender_id, body, is_broadcast) values (cid, me, txt, true);
    update public.customers set last_contact_at = now() where id = t.customer_id;
    n := n + 1;
  end loop;
  update public.broadcasts set recipients = n where id = bid;
  return n;
end;
$$;

create or replace function public.list_broadcasts(p_business uuid)
returns table (id uuid, body text, recipients integer, created_at timestamptz, sent_by_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_business_manager(p_business) then raise exception 'forbidden'; end if;
  return query select b.id, b.body, b.recipients, b.created_at, p.display_name
    from public.broadcasts b left join public.profiles p on p.id = b.sent_by where b.business_id = p_business order by b.created_at desc limit 30;
end;
$$;

-- the customer's side: stop (or resume) receiving broadcasts from one business
create or replace function public.broadcast_optout(p_business uuid, p_out boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_out then insert into public.broadcast_optouts (business_id, user_id) values (p_business, me) on conflict do nothing;
  else delete from public.broadcast_optouts where business_id = p_business and user_id = me;
  end if;
end;
$$;
create or replace function public.get_broadcast_optout(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.broadcast_optouts where business_id = p_business and user_id = (select auth.uid()));
$$;

revoke execute on function public.broadcast_audience(uuid, text, text), public.send_broadcast(uuid, text, text, text), public.list_broadcasts(uuid), public.broadcast_optout(uuid, boolean), public.get_broadcast_optout(uuid) from public, anon;
grant execute on function public.broadcast_audience(uuid, text, text), public.send_broadcast(uuid, text, text, text), public.list_broadcasts(uuid), public.broadcast_optout(uuid, boolean), public.get_broadcast_optout(uuid) to authenticated;
