-- CIFRA foundation: identities, private conversations and business workspaces.
-- Run this migration in Supabase SQL Editor before enabling production sign-ups.

create extension if not exists pgcrypto;

create type public.business_role as enum ('owner', 'admin', 'supervisor', 'agent', 'viewer');
create type public.conversation_kind as enum ('direct', 'group', 'business');
create type public.conversation_state as enum ('open', 'pending', 'resolved', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  username text unique check (username ~ '^[a-z0-9_]{3,32}$'),
  bio text check (char_length(bio) <= 500),
  avatar_path text,
  locale text not null default 'es',
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  handle text unique check (handle ~ '^[a-z0-9-]{3,48}$'),
  description text check (char_length(description) <= 1000),
  category text,
  email text,
  phone text,
  website text,
  address text,
  timezone text not null default 'Europe/Berlin',
  business_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.business_role not null default 'agent',
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_user_id uuid references public.profiles(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  phone text,
  email text,
  labels text[] not null default '{}',
  private_note text check (char_length(private_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete cascade,
  title text check (char_length(title) <= 160),
  state public.conversation_state not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'business') = (business_id is not null))
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted_until timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text check (char_length(body) <= 10000),
  attachment_path text,
  attachment_type text,
  reply_to_id uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (body is not null or attachment_path is not null)
);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text check (char_length(description) <= 5000),
  price_minor integer check (price_minor >= 0),
  currency char(3),
  image_path text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_owner_id_idx on public.contacts(owner_id);
create index conversations_business_id_idx on public.conversations(business_id);
create index conversation_members_user_id_idx on public.conversation_members(user_id);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index catalog_items_business_id_idx on public.catalog_items(business_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();
create trigger catalog_items_updated_at before update on public.catalog_items for each row execute function public.set_updated_at();

create or replace function public.is_business_member(target_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_business_manager(target_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin', 'supervisor')
  );
$$;

create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = target_conversation_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, new.phone, 'cifra'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.add_business_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_members (business_id, user_id, role, invited_by)
  values (new.id, new.owner_id, 'owner', new.owner_id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create trigger on_business_created
  after insert on public.businesses
  for each row execute procedure public.add_business_owner();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.catalog_items enable row level security;

revoke all on public.profiles, public.businesses, public.business_members, public.contacts, public.conversations, public.conversation_members, public.messages, public.catalog_items from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.businesses, public.business_members, public.contacts, public.conversations, public.conversation_members, public.messages, public.catalog_items to authenticated;

create policy "profiles: owner reads" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: owner updates" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "businesses: member reads" on public.businesses for select to authenticated using (public.is_business_member(id));
create policy "businesses: user creates own" on public.businesses for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "businesses: manager updates" on public.businesses for update to authenticated using (public.is_business_manager(id)) with check (public.is_business_manager(id));
create policy "businesses: owner deletes" on public.businesses for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "business members: member reads" on public.business_members for select to authenticated using (public.is_business_member(business_id));
create policy "business members: manager adds" on public.business_members for insert to authenticated with check (public.is_business_manager(business_id));
create policy "business members: manager updates" on public.business_members for update to authenticated using (public.is_business_manager(business_id)) with check (public.is_business_manager(business_id));
create policy "business members: manager removes" on public.business_members for delete to authenticated using (public.is_business_manager(business_id));

create policy "contacts: owner manages" on public.contacts for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "conversations: member reads" on public.conversations for select to authenticated using (public.is_conversation_member(id));
create policy "conversations: creator creates" on public.conversations for insert to authenticated with check ((select auth.uid()) = created_by and (business_id is null or public.is_business_member(business_id)));
create policy "conversations: business manager updates" on public.conversations for update to authenticated using ((business_id is null and created_by = (select auth.uid())) or (business_id is not null and public.is_business_manager(business_id))) with check ((business_id is null and created_by = (select auth.uid())) or (business_id is not null and public.is_business_manager(business_id)));

create policy "conversation members: member reads" on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "conversation members: creator adds" on public.conversation_members for insert to authenticated with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = (select auth.uid())));
create policy "conversation members: self updates own read state" on public.conversation_members for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "conversation members: creator removes" on public.conversation_members for delete to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = (select auth.uid())));

create policy "messages: member reads" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "messages: member sends as self" on public.messages for insert to authenticated with check ((select auth.uid()) = sender_id and public.is_conversation_member(conversation_id));
create policy "messages: sender edits" on public.messages for update to authenticated using ((select auth.uid()) = sender_id) with check ((select auth.uid()) = sender_id);

create policy "catalog: member reads" on public.catalog_items for select to authenticated using (public.is_business_member(business_id));
create policy "catalog: manager creates" on public.catalog_items for insert to authenticated with check (public.is_business_manager(business_id));
create policy "catalog: manager updates" on public.catalog_items for update to authenticated using (public.is_business_manager(business_id)) with check (public.is_business_manager(business_id));
create policy "catalog: manager deletes" on public.catalog_items for delete to authenticated using (public.is_business_manager(business_id));

-- The owner membership is created by a security-definer trigger. The client cannot
-- assign itself any other privileged role; invitations remain manager-only.
