-- CIFRA v8: profile pages (public @username + member-since), business phone privacy, CRM (customers, tasks),
-- agenda (appointments requested/created/confirmed from chat). Safe to re-run.

-- ── Profiles: expose the @username and join date to people you share a chat/business with ─────────────────────
drop function if exists public.get_profiles(uuid[]);
create or replace function public.get_profiles(p_ids uuid[])
returns table (id uuid, display_name text, avatar_path text, phone text, bio text, username text, created_at timestamptz)
language sql stable security definer set search_path = public as $q$
  select p.id, p.display_name, p.avatar_path,
         case when p.id = (select auth.uid()) or (public.shares_conversation_with(p.id) and not p.hide_phone) then p.phone end,
         p.bio, p.username, p.created_at
  from public.profiles p
  where p.id = any (p_ids)
    and (p.id = (select auth.uid()) or public.shares_conversation_with(p.id) or public.shares_business_with(p.id));
$q$;

-- ── Business phone privacy: the public page only shows the phone when the owner opts in ───────────────────────
alter table public.businesses add column if not exists show_phone boolean not null default false;
grant update (show_phone) on public.businesses to authenticated;

create or replace function public.get_business_public(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'handle', b.handle, 'category', b.category, 'description', b.description, 'logo_path', b.logo_path,
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

-- ── Role helper: who can work (not just read) inside a business ───────────────────────────────────────────────
create or replace function public.is_business_agent(target_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id and user_id = (select auth.uid()) and role in ('owner', 'admin', 'supervisor', 'agent')
  );
$$;

-- ── CRM: customers ────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 200),
  stage text not null default 'lead' check (stage in ('lead', 'contacted', 'proposal', 'won', 'lost')),
  tags text[] not null default '{}',
  notes text check (char_length(notes) <= 4000),
  value_minor integer check (value_minor >= 0),
  last_contact_at timestamptz,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index if not exists customers_business_idx on public.customers (business_id, stage);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists crm_tasks_business_idx on public.crm_tasks (business_id, done, due_at);

-- ── Agenda: appointments ──────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_user_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  notes text check (char_length(notes) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('requested', 'scheduled', 'confirmed', 'done', 'cancelled', 'no_show')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists appointments_business_idx on public.appointments (business_id, starts_at);
create index if not exists appointments_customer_idx on public.appointments (customer_user_id, starts_at);

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.appointments enable row level security;

revoke all on public.customers, public.crm_tasks, public.appointments from anon, authenticated;
grant select on public.customers, public.crm_tasks, public.appointments to authenticated;
grant insert (business_id, name, phone, email, stage, tags, notes, value_minor) on public.customers to authenticated;
grant update (name, phone, email, stage, tags, notes, value_minor, last_contact_at) on public.customers to authenticated;
grant delete on public.customers to authenticated;
grant insert (business_id, customer_id, title, due_at, assigned_to) on public.crm_tasks to authenticated;
grant update (title, due_at, done, done_at, assigned_to) on public.crm_tasks to authenticated;
grant delete on public.crm_tasks to authenticated;

drop policy if exists "customers: member reads" on public.customers;
create policy "customers: member reads" on public.customers for select to authenticated using (public.is_business_member(business_id));
drop policy if exists "customers: agent adds" on public.customers;
create policy "customers: agent adds" on public.customers for insert to authenticated with check (public.is_business_agent(business_id));
drop policy if exists "customers: agent edits" on public.customers;
create policy "customers: agent edits" on public.customers for update to authenticated using (public.is_business_agent(business_id)) with check (public.is_business_agent(business_id));
drop policy if exists "customers: manager deletes" on public.customers;
create policy "customers: manager deletes" on public.customers for delete to authenticated using (public.is_business_manager(business_id));

drop policy if exists "tasks: member reads" on public.crm_tasks;
create policy "tasks: member reads" on public.crm_tasks for select to authenticated using (public.is_business_member(business_id));
drop policy if exists "tasks: agent adds" on public.crm_tasks;
create policy "tasks: agent adds" on public.crm_tasks for insert to authenticated with check (public.is_business_agent(business_id) and (customer_id is null or exists (select 1 from public.customers c where c.id = customer_id and c.business_id = crm_tasks.business_id)));
drop policy if exists "tasks: agent edits" on public.crm_tasks;
create policy "tasks: agent edits" on public.crm_tasks for update to authenticated using (public.is_business_agent(business_id)) with check (public.is_business_agent(business_id));
drop policy if exists "tasks: manager or author deletes" on public.crm_tasks;
create policy "tasks: manager or author deletes" on public.crm_tasks for delete to authenticated using (public.is_business_manager(business_id) or created_by = (select auth.uid()));

drop policy if exists "appointments: team or customer reads" on public.appointments;
create policy "appointments: team or customer reads" on public.appointments for select to authenticated using (public.is_business_member(business_id) or customer_user_id = (select auth.uid()));

-- ── CRM sync: every person who has written to the business becomes a customer card (private phone only if public) ──
create or replace function public.crm_sync(p_business uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_business_agent(p_business) then raise exception 'forbidden'; end if;
  insert into public.customers (business_id, user_id, name, phone, created_by)
  select c.business_id, c.customer_id, p.display_name, case when p.hide_phone then null else p.phone end, (select auth.uid())
  from public.conversations c join public.profiles p on p.id = c.customer_id
  where c.business_id = p_business and c.kind = 'business' and c.customer_id is not null
  on conflict (business_id, user_id) do nothing;
  get diagnostics n = row_count;
  update public.customers cu
     set last_contact_at = (select max(m.created_at) from public.messages m join public.conversations c on c.id = m.conversation_id
                            where c.business_id = cu.business_id and c.customer_id = cu.user_id and c.kind = 'business')
   where cu.business_id = p_business and cu.user_id is not null;
  return n;
end;
$$;

-- internal helper (not exposed): the customer's chat with a business, created on demand
create or replace function public.ensure_business_conversation(p_business uuid, p_customer uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from public.conversations where business_id = p_business and customer_id = p_customer and kind = 'business';
  if cid is null then
    insert into public.conversations (kind, created_by, business_id, customer_id) values ('business', p_customer, p_business, p_customer)
      on conflict (business_id, customer_id) where kind = 'business' do nothing
      returning id into cid;
    if cid is null then
      select id into cid from public.conversations where business_id = p_business and customer_id = p_customer and kind = 'business';
    else
      insert into public.conversation_members (conversation_id, user_id) values (cid, p_customer);
    end if;
  end if;
  return cid;
end;
$$;

drop function if exists public.appointment_card(text, timestamptz, text);
create or replace function public.appointment_card(p_title text, p_start timestamptz, p_label text, p_id uuid)
returns text language sql immutable as $$
  -- chr() keeps this file pure ASCII, so copy/paste into the SQL editor can never corrupt the emoji or the middle dot
  select chr(128197) || ' ' || p_label || ' ' || chr(183) || ' ' || p_title || ' ' || chr(183) || ' '
         || to_char(p_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') || ' ' || chr(183) || ' ' || p_id::text;
$$;

-- team creates an appointment (optionally with a customer, who gets a card in their chat)
create or replace function public.create_appointment(p_business uuid, p_customer uuid, p_title text, p_start timestamptz, p_end timestamptz, p_notes text default null, p_assigned uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  cu public.customers;
  cid uuid;
  aid uuid;
begin
  if not public.is_business_agent(p_business) then raise exception 'forbidden'; end if;
  if p_end <= p_start then raise exception 'invalid_range'; end if;
  if p_assigned is not null and not exists (select 1 from public.business_members where business_id = p_business and user_id = p_assigned) then raise exception 'assignee_not_in_team'; end if;
  if p_assigned is not null and exists (select 1 from public.appointments a where a.business_id = p_business and a.assigned_to = p_assigned and a.status in ('scheduled', 'confirmed') and a.starts_at < p_end and a.ends_at > p_start) then
    raise exception 'appointment_overlap';
  end if;
  perform public.check_rate('create_appointment', 120, interval '1 hour');
  if p_customer is not null then
    select * into cu from public.customers where id = p_customer and business_id = p_business;
    if cu.id is null then raise exception 'customer_not_found'; end if;
    if cu.user_id is not null then cid := public.ensure_business_conversation(p_business, cu.user_id); end if;
  end if;
  insert into public.appointments (business_id, customer_id, customer_user_id, conversation_id, title, notes, starts_at, ends_at, status, assigned_to, created_by)
  values (p_business, p_customer, cu.user_id, cid, btrim(p_title), nullif(btrim(coalesce(p_notes, '')), ''), p_start, p_end, 'scheduled', p_assigned, me)
  returning id into aid;
  if cid is not null then
    insert into public.messages (conversation_id, sender_id, body) values (cid, me, public.appointment_card(btrim(p_title), p_start, 'Cita agendada', aid));
  end if;
  return aid;
end;
$$;

-- team changes status / time of an appointment; the customer is told in the chat
create or replace function public.update_appointment(p_id uuid, p_status text default null, p_start timestamptz default null, p_end timestamptz default null, p_title text default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  a public.appointments;
  new_start timestamptz;
  new_end timestamptz;
  label text;
begin
  select * into a from public.appointments where id = p_id;
  if a.id is null or not public.is_business_agent(a.business_id) then raise exception 'forbidden'; end if;
  if p_status is not null and p_status not in ('requested', 'scheduled', 'confirmed', 'done', 'cancelled', 'no_show') then raise exception 'invalid_status'; end if;
  new_start := coalesce(p_start, a.starts_at);
  new_end := case when p_start is not null and p_end is null then p_start + (a.ends_at - a.starts_at) else coalesce(p_end, a.ends_at) end;
  if new_end <= new_start then raise exception 'invalid_range'; end if;
  update public.appointments
     set status = coalesce(p_status, status), starts_at = new_start, ends_at = new_end,
         title = coalesce(nullif(btrim(coalesce(p_title, '')), ''), title), notes = case when p_notes is null then notes else nullif(btrim(p_notes), '') end
   where id = p_id;
  label := case
    when p_status = 'confirmed' then 'Cita confirmada'
    when p_status = 'cancelled' then 'Cita cancelada'
    when p_status = 'scheduled' and a.status = 'requested' then 'Cita aceptada'
    when p_start is not null and p_start <> a.starts_at then 'Cita reprogramada'
    else null end;
  if label is not null and a.conversation_id is not null then
    insert into public.messages (conversation_id, sender_id, body) values (a.conversation_id, me, public.appointment_card(coalesce(nullif(btrim(coalesce(p_title, '')), ''), a.title), new_start, label, p_id));
  end if;
end;
$$;

-- a customer asks the business for an appointment from its public profile
create or replace function public.request_appointment(p_business uuid, p_start timestamptz, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  cid uuid;
  aid uuid;
  nm text;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.businesses where id = p_business and is_public) then raise exception 'business_not_found'; end if;
  if public.is_business_member(p_business) then raise exception 'own_business'; end if;
  if p_start < now() or p_start > now() + interval '1 year' then raise exception 'invalid_range'; end if;
  perform public.check_rate('request_appointment', 10, interval '1 day');
  cid := public.ensure_business_conversation(p_business, me);
  select display_name into nm from public.profiles where id = me;
  insert into public.customers (business_id, user_id, name, created_by) values (p_business, me, coalesce(nm, 'Cliente'), me) on conflict (business_id, user_id) do nothing;
  insert into public.appointments (business_id, customer_id, customer_user_id, conversation_id, title, notes, starts_at, ends_at, status, created_by)
  values (p_business, (select id from public.customers where business_id = p_business and user_id = me), me, cid, 'Cita solicitada', nullif(btrim(coalesce(p_note, '')), ''), p_start, p_start + interval '30 minutes', 'requested', me)
  returning id into aid;
  insert into public.messages (conversation_id, sender_id, body) values (cid, me, public.appointment_card('Cita solicitada', p_start, 'Solicitud de cita', aid));
  return aid;
end;
$$;

-- the customer confirms or cancels their own appointment
create or replace function public.respond_appointment(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  a public.appointments;
begin
  if p_status not in ('confirmed', 'cancelled') then raise exception 'invalid_status'; end if;
  select * into a from public.appointments where id = p_id and customer_user_id = me;
  if a.id is null then raise exception 'forbidden'; end if;
  if a.status in ('done', 'no_show', 'cancelled') then raise exception 'invalid_status'; end if;
  if p_status = 'confirmed' and a.status = 'requested' then raise exception 'invalid_status'; end if;
  update public.appointments set status = p_status where id = p_id;
  if a.conversation_id is not null then
    insert into public.messages (conversation_id, sender_id, body) values (a.conversation_id, me, public.appointment_card(a.title, a.starts_at, case when p_status = 'confirmed' then 'Cita confirmada' else 'Cita cancelada' end, p_id));
  end if;
end;
$$;

-- the customer's own appointments across businesses
create or replace function public.my_appointments()
returns table (id uuid, business_id uuid, business_name text, logo_path text, title text, starts_at timestamptz, ends_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select a.id, a.business_id, b.name, b.logo_path, a.title, a.starts_at, a.ends_at, a.status
  from public.appointments a join public.businesses b on b.id = a.business_id
  where a.customer_user_id = (select auth.uid()) and a.status <> 'cancelled' and a.ends_at > now() - interval '1 day'
  order by a.starts_at limit 100;
$$;

revoke execute on all functions in schema public from public, anon;
revoke execute on function public.ensure_business_conversation(uuid, uuid) from authenticated;
grant execute on function public.is_business_agent(uuid), public.get_profiles(uuid[]), public.get_business_public(uuid), public.crm_sync(uuid),
  public.create_appointment(uuid, uuid, text, timestamptz, timestamptz, text, uuid), public.update_appointment(uuid, text, timestamptz, timestamptz, text, text),
  public.request_appointment(uuid, timestamptz, text), public.respond_appointment(uuid, text), public.my_appointments() to authenticated;
