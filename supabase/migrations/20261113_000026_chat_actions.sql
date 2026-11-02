-- Migration 26: action buttons shown to customers above the message box of a business chat (book, catalog, call, talk to a person, any link).
-- The business chooses which ones to show, in which order, with what label and an optional URL. Safe to re-run.
create table if not exists public.business_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null check (type in ('appointment', 'catalog', 'call', 'human', 'link')),
  label text not null check (char_length(label) between 1 and 40),
  url text check (url is null or (char_length(url) <= 500 and url ~ '^(https://|tel:|mailto:)[^[:space:]]+$')),
  enabled boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  check (type <> 'link' or url is not null)
);
create index if not exists business_actions_business_idx on public.business_actions (business_id, position);
alter table public.business_actions enable row level security;
revoke all on public.business_actions from anon, authenticated;
grant select on public.business_actions to authenticated;
grant all on public.business_actions to service_role;
drop policy if exists business_actions_read on public.business_actions;
create policy business_actions_read on public.business_actions for select to authenticated using (public.is_business_manager(business_id));

-- The team replaces the whole list in one go (atomic, validated).
create or replace function public.set_business_actions(p_business uuid, p_actions jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare a jsonb; i integer := 0;
begin
  if not public.is_business_manager(p_business) then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_actions) <> 'array' or jsonb_array_length(p_actions) > 8 then raise exception 'invalid_actions'; end if;
  delete from public.business_actions where business_id = p_business;
  for a in select * from jsonb_array_elements(p_actions) loop
    insert into public.business_actions (business_id, type, label, url, enabled, position)
    values (p_business, a->>'type', left(btrim(coalesce(a->>'label', '')), 40), nullif(btrim(coalesce(a->>'url', '')), ''), coalesce((a->>'enabled')::boolean, true), i);
    i := i + 1;
  end loop;
end;
$$;

-- What a customer (or the team) sees: public businesses, the team, and people who already have a chat with it.
create or replace function public.business_actions_for(p_business uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not (public.is_business_member(p_business)
          or exists (select 1 from public.businesses b where b.id = p_business and b.is_public)
          or exists (select 1 from public.conversations c where c.business_id = p_business and c.customer_id = me and c.kind = 'business')) then
    return jsonb_build_object('configured', false, 'actions', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'configured', exists (select 1 from public.business_actions where business_id = p_business),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'label', label, 'url', url) order by position) from public.business_actions where business_id = p_business and enabled), '[]'::jsonb));
end;
$$;
revoke execute on function public.set_business_actions(uuid, jsonb), public.business_actions_for(uuid) from public, anon;
grant execute on function public.set_business_actions(uuid, jsonb), public.business_actions_for(uuid) to authenticated;
