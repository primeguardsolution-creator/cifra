-- Migration 24: integrations. Outgoing webhooks (signed, retried) and API keys for incoming automation (Make, Zapier, n8n, your own code).
-- Delivery itself is done by the Netlify function /api/webhooks-dispatch (scheduled every minute) with the service role.
-- Safe to re-run.

-- 1) Outgoing webhooks of a business
create table if not exists public.integration_webhooks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null default 'Webhook' check (char_length(name) between 1 and 60),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  secret text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  events text[] not null default '{}',
  active boolean not null default true,
  last_status integer,
  last_error text,
  last_at timestamptz,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (events <@ array['message.received', 'conversation.created', 'customer.created', 'customer.stage_changed', 'appointment.created', 'appointment.updated']::text[])
);
create index if not exists integration_webhooks_business_idx on public.integration_webhooks (business_id) where active;
alter table public.integration_webhooks enable row level security;
revoke all on public.integration_webhooks from anon, authenticated;
grant select on public.integration_webhooks to authenticated;
grant insert (business_id, name, url, events, active) on public.integration_webhooks to authenticated;
grant update (name, url, events, active) on public.integration_webhooks to authenticated;
grant delete on public.integration_webhooks to authenticated;
grant all on public.integration_webhooks to service_role;
drop policy if exists integration_webhooks_manage on public.integration_webhooks;
create policy integration_webhooks_manage on public.integration_webhooks for all to authenticated
  using (public.is_business_manager(business_id)) with check (public.is_business_manager(business_id));

-- 2) Delivery queue and log
create table if not exists public.integration_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.integration_webhooks(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts integer not null default 0,
  next_try_at timestamptz not null default now(),
  response_code integer,
  error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists integration_deliveries_queue_idx on public.integration_deliveries (next_try_at) where status = 'pending';
create index if not exists integration_deliveries_webhook_idx on public.integration_deliveries (webhook_id, created_at desc);
alter table public.integration_deliveries enable row level security;
revoke all on public.integration_deliveries from anon, authenticated;
grant select on public.integration_deliveries to authenticated;
grant all on public.integration_deliveries to service_role;
drop policy if exists integration_deliveries_read on public.integration_deliveries;
create policy integration_deliveries_read on public.integration_deliveries for select to authenticated using (public.is_business_manager(business_id));

-- 3) API keys for incoming calls (only the hash is stored; the key is shown once)
create table if not exists public.integration_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.integration_keys enable row level security;
revoke all on public.integration_keys from anon, authenticated;
grant select (id, business_id, name, key_prefix, created_at, last_used_at, revoked_at) on public.integration_keys to authenticated;
grant all on public.integration_keys to service_role;
drop policy if exists integration_keys_read on public.integration_keys;
create policy integration_keys_read on public.integration_keys for select to authenticated using (public.is_business_manager(business_id));

create or replace function public.create_api_key(p_business uuid, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if not public.is_business_manager(p_business) then raise exception 'forbidden'; end if;
  if (select count(*) from public.integration_keys where business_id = p_business and revoked_at is null) >= 10 then raise exception 'too_many_keys'; end if;
  k := 'cifra_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.integration_keys (business_id, name, key_hash, key_prefix) values (p_business, left(btrim(coalesce(p_name, 'API')), 60), encode(sha256(convert_to(k, 'utf8')), 'hex'), left(k, 12));
  return k;
end;
$$;
create or replace function public.revoke_api_key(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  select business_id into b from public.integration_keys where id = p_id;
  if b is null or not public.is_business_manager(b) then raise exception 'forbidden'; end if;
  update public.integration_keys set revoked_at = now() where id = p_id and revoked_at is null;
end;
$$;
revoke execute on function public.create_api_key(uuid, text), public.revoke_api_key(uuid) from public, anon;
grant execute on function public.create_api_key(uuid, text), public.revoke_api_key(uuid) to authenticated;

-- 4) Events: one row per subscribed webhook. Never able to break the action that caused it.
create or replace function public.emit_integration_event(p_business uuid, p_event text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.integration_deliveries (webhook_id, business_id, event, payload)
  select w.id, p_business, p_event, jsonb_build_object('id', gen_random_uuid(), 'event', p_event, 'created_at', now(), 'business_id', p_business, 'data', p_data)
  from public.integration_webhooks w
  where w.business_id = p_business and w.active and p_event = any (w.events)
    and (select count(*) from public.integration_deliveries d where d.webhook_id = w.id and d.status = 'pending') < 1000;
exception when others then null;
end;
$$;
revoke all on function public.emit_integration_event(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.integration_customer_json(c public.customers)
returns jsonb language sql immutable as $$
  select jsonb_build_object('id', c.id, 'user_id', c.user_id, 'name', c.name, 'phone', c.phone, 'email', c.email, 'stage', c.stage, 'tags', to_jsonb(c.tags), 'value_minor', c.value_minor);
$$;

create or replace function public.trg_integration_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare cv public.conversations; cu public.customers; nm text;
begin
  if new.is_internal or new.is_automated then return new; end if;
  select * into cv from public.conversations where id = new.conversation_id;
  if cv.kind is distinct from 'business' or cv.business_id is null or new.sender_id is distinct from cv.customer_id then return new; end if;
  if not exists (select 1 from public.integration_webhooks w where w.business_id = cv.business_id and w.active and 'message.received' = any (w.events)) then return new; end if;
  select * into cu from public.customers where business_id = cv.business_id and user_id = new.sender_id;
  select display_name into nm from public.profiles where id = new.sender_id;
  perform public.emit_integration_event(cv.business_id, 'message.received', jsonb_build_object(
    'conversation_id', cv.id, 'message_id', new.id, 'text', new.body, 'attachment_type', new.attachment_type, 'sent_at', new.created_at,
    'customer', jsonb_build_object('user_id', new.sender_id, 'name', coalesce(cu.name, nm), 'customer_id', cu.id)));
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists messages_integration on public.messages;
create trigger messages_integration after insert on public.messages for each row execute function public.trg_integration_message();

create or replace function public.trg_integration_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if new.kind <> 'business' or new.business_id is null then return new; end if;
  select display_name into nm from public.profiles where id = new.customer_id;
  perform public.emit_integration_event(new.business_id, 'conversation.created', jsonb_build_object('conversation_id', new.id, 'customer', jsonb_build_object('user_id', new.customer_id, 'name', nm)));
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists conversations_integration on public.conversations;
create trigger conversations_integration after insert on public.conversations for each row execute function public.trg_integration_conversation();

create or replace function public.trg_integration_customer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_integration_event(new.business_id, 'customer.created', jsonb_build_object('customer', public.integration_customer_json(new)));
  elsif new.stage is distinct from old.stage then
    perform public.emit_integration_event(new.business_id, 'customer.stage_changed', jsonb_build_object('customer', public.integration_customer_json(new), 'from', old.stage, 'to', new.stage));
  end if;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists customers_integration on public.customers;
create trigger customers_integration after insert or update of stage on public.customers for each row execute function public.trg_integration_customer();

create or replace function public.trg_integration_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  d := jsonb_build_object('appointment', jsonb_build_object('id', new.id, 'title', new.title, 'starts_at', new.starts_at, 'ends_at', new.ends_at, 'status', new.status, 'customer_id', new.customer_id, 'assigned_to', new.assigned_to));
  if tg_op = 'INSERT' then perform public.emit_integration_event(new.business_id, 'appointment.created', d);
  elsif new.status is distinct from old.status or new.starts_at is distinct from old.starts_at then perform public.emit_integration_event(new.business_id, 'appointment.updated', d || jsonb_build_object('previous_status', old.status));
  end if;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists appointments_integration on public.appointments;
create trigger appointments_integration after insert or update of status, starts_at on public.appointments for each row execute function public.trg_integration_appointment();

-- A test ping for one webhook (managers only); the dispatcher delivers it.
create or replace function public.webhook_test(p_webhook uuid)
returns void language plpgsql security definer set search_path = public as $$
declare w public.integration_webhooks;
begin
  select * into w from public.integration_webhooks where id = p_webhook;
  if w.id is null or not public.is_business_manager(w.business_id) then raise exception 'forbidden'; end if;
  perform public.check_rate('webhook_test', 20, interval '10 minutes');
  insert into public.integration_deliveries (webhook_id, business_id, event, payload)
  values (w.id, w.business_id, 'test.ping', jsonb_build_object('id', gen_random_uuid(), 'event', 'test.ping', 'created_at', now(), 'business_id', w.business_id, 'data', jsonb_build_object('message', 'Hello from CIFRA')));
end;
$$;
revoke execute on function public.webhook_test(uuid) from public, anon;
grant execute on function public.webhook_test(uuid) to authenticated;

-- 5) Service-role helpers for the dispatcher and the incoming API
create or replace function public.claim_deliveries(p_limit integer default 25, p_webhook uuid default null)
returns table (id uuid, webhook_id uuid, event text, payload jsonb, attempts integer, url text, secret text)
language plpgsql security definer set search_path = public as $$
begin
  delete from public.integration_deliveries where created_at < now() - interval '14 days';
  return query
  with c as (
    select d.id from public.integration_deliveries d join public.integration_webhooks w on w.id = d.webhook_id
    where d.status = 'pending' and d.next_try_at <= now() and w.active and (p_webhook is null or d.webhook_id = p_webhook)
    order by d.next_try_at limit least(greatest(p_limit, 1), 100) for update of d skip locked
  )
  update public.integration_deliveries d set attempts = d.attempts + 1, next_try_at = now() + interval '2 minutes'
  from c, public.integration_webhooks w
  where d.id = c.id and w.id = d.webhook_id
  returning d.id, d.webhook_id, d.event, d.payload, d.attempts, w.url, w.secret;
end;
$$;
create or replace function public.report_delivery(p_id uuid, p_ok boolean, p_code integer, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.integration_deliveries;
begin
  select * into d from public.integration_deliveries where id = p_id;
  if d.id is null then return; end if;
  if p_ok then
    update public.integration_deliveries set status = 'delivered', delivered_at = now(), response_code = p_code, error = null where id = p_id;
  elsif d.attempts >= 6 then
    update public.integration_deliveries set status = 'failed', response_code = p_code, error = left(p_error, 300) where id = p_id;
  else
    update public.integration_deliveries set response_code = p_code, error = left(p_error, 300),
      next_try_at = now() + (case d.attempts when 1 then interval '1 minute' when 2 then interval '5 minutes' when 3 then interval '30 minutes' when 4 then interval '2 hours' else interval '12 hours' end) where id = p_id;
  end if;
  update public.integration_webhooks set last_status = p_code, last_error = case when p_ok then null else left(p_error, 300) end, last_at = now() where id = d.webhook_id;
end;
$$;
create or replace function public.api_key_auth(p_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  update public.integration_keys set last_used_at = now() where key_hash = p_hash and revoked_at is null returning business_id into b;
  return b;
end;
$$;
create or replace function public.api_upsert_customer(p_business uuid, p_name text, p_phone text, p_email text, p_stage text, p_tags text[], p_notes text, p_value_minor integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cu public.customers; digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'); em text := nullif(lower(btrim(coalesce(p_email, ''))), ''); created boolean := false;
begin
  if p_stage is not null and p_stage not in ('lead', 'contacted', 'proposal', 'won', 'lost') then raise exception 'invalid_stage'; end if;
  if digits <> '' then select * into cu from public.customers where business_id = p_business and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = digits limit 1; end if;
  if cu.id is null and em is not null then select * into cu from public.customers where business_id = p_business and lower(email) = em limit 1; end if;
  if cu.id is null then
    if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'name_required'; end if;
    if (select count(*) from public.customers where business_id = p_business) >= 20000 then raise exception 'customer_limit'; end if;
    insert into public.customers (business_id, name, phone, email, stage, tags, notes, value_minor, created_by)
    values (p_business, left(btrim(p_name), 120), nullif(btrim(coalesce(p_phone, '')), ''), em, coalesce(p_stage, 'lead'), coalesce(p_tags, '{}'), left(p_notes, 4000), p_value_minor, null) returning * into cu;
    created := true;
  else
    update public.customers set name = coalesce(nullif(left(btrim(coalesce(p_name, '')), 120), ''), name), phone = coalesce(nullif(btrim(coalesce(p_phone, '')), ''), phone), email = coalesce(em, email),
      stage = coalesce(p_stage, stage), tags = (select coalesce(array_agg(distinct x), '{}') from unnest(tags || coalesce(p_tags, '{}')) x), notes = coalesce(left(p_notes, 4000), notes), value_minor = coalesce(p_value_minor, value_minor)
    where id = cu.id returning * into cu;
  end if;
  return jsonb_build_object('id', cu.id, 'created', created, 'customer', public.integration_customer_json(cu));
end;
$$;
create or replace function public.api_create_task(p_business uuid, p_customer uuid, p_title text, p_due timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if nullif(btrim(coalesce(p_title, '')), '') is null then raise exception 'title_required'; end if;
  if p_customer is not null and not exists (select 1 from public.customers where id = p_customer and business_id = p_business) then raise exception 'customer_not_found'; end if;
  insert into public.crm_tasks (business_id, customer_id, title, due_at, created_by) values (p_business, p_customer, left(btrim(p_title), 200), p_due, null) returning id into tid;
  return tid;
end;
$$;
revoke all on function public.claim_deliveries(integer, uuid), public.report_delivery(uuid, boolean, integer, text), public.api_key_auth(text),
  public.api_upsert_customer(uuid, text, text, text, text, text[], text, integer), public.api_create_task(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_deliveries(integer, uuid), public.report_delivery(uuid, boolean, integer, text), public.api_key_auth(text),
  public.api_upsert_customer(uuid, text, text, text, text, text[], text, integer), public.api_create_task(uuid, uuid, text, timestamptz) to service_role;
