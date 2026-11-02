-- Migration 23: (1) who can see a status, (2) background tone of a business workspace, (3) no double-booking, (4) reactions limited to the app's set.
-- Safe to re-run.

-- 1) Status audience: everyone I chat with (default), everyone except some people, or only some people.
alter table public.statuses add column if not exists audience_mode text not null default 'all';
alter table public.statuses drop constraint if exists statuses_audience_mode_check;
alter table public.statuses add constraint statuses_audience_mode_check check (audience_mode in ('all', 'except', 'only'));
alter table public.statuses add column if not exists audience_ids uuid[] not null default '{}';
alter table public.statuses drop constraint if exists statuses_audience_ids_check;
alter table public.statuses add constraint statuses_audience_ids_check check (cardinality(audience_ids) <= 500);
grant insert (audience_mode, audience_ids) on public.statuses to authenticated;

drop policy if exists "statuses: visible" on public.statuses;
create policy "statuses: visible" on public.statuses for select to authenticated using (
  expires_at > now() and (
    user_id = (select auth.uid())
    or (business_id is null and public.shares_conversation_with(user_id) and (
         audience_mode = 'all'
         or (audience_mode = 'only' and (select auth.uid()) = any (audience_ids))
         or (audience_mode = 'except' and not ((select auth.uid()) = any (audience_ids)))
       ))
    or (business_id is not null and (public.is_business_member(business_id) or exists (select 1 from public.businesses b where b.id = business_id and b.is_public)))
  )
);

-- 2) Background tone of the Business workspace (shared by the whole team).
alter table public.businesses add column if not exists surface_tone text not null default 'default';
alter table public.businesses drop constraint if exists businesses_surface_tone_check;
alter table public.businesses add constraint businesses_surface_tone_check check (surface_tone in ('default', 'neutral', 'sky', 'mint', 'rose', 'slate'));
grant update (surface_tone) on public.businesses to authenticated;

-- 3) No double-booking: two active appointments of one business cannot overlap, unless each is assigned to a different person.
--    One customer cannot be in two active appointments at once either.
create or replace function public.appointments_no_overlap()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status not in ('scheduled', 'confirmed') then return new; end if;
  if tg_op = 'UPDATE' and new.starts_at = old.starts_at and new.ends_at = old.ends_at and new.status = old.status and new.assigned_to is not distinct from old.assigned_to then return new; end if;
  if exists (
    select 1 from public.appointments a
    where a.business_id = new.business_id and a.id <> new.id and a.status in ('scheduled', 'confirmed')
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
      and (
        a.assigned_to is null or new.assigned_to is null or a.assigned_to = new.assigned_to
        or (new.customer_id is not null and a.customer_id = new.customer_id)
        or (new.customer_user_id is not null and a.customer_user_id = new.customer_user_id)
      )
  ) then raise exception 'appointment_overlap'; end if;
  return new;
end;
$$;
drop trigger if exists appointments_no_overlap on public.appointments;
create trigger appointments_no_overlap before insert or update on public.appointments for each row execute function public.appointments_no_overlap();

-- 4) Reactions: only the six the app offers (rows already stored are left alone).
alter table public.message_reactions drop constraint if exists message_reactions_emoji_set;
alter table public.message_reactions add constraint message_reactions_emoji_set check (emoji in (U&'\+01F44D', U&'\2764\FE0F', U&'\+01F602', U&'\+01F62E', U&'\+01F622', U&'\+01F64F')) not valid;
