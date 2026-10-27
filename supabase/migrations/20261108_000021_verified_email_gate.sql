-- Migration 21: creating a business or opening a NEW chat with one requires a verified e-mail (anti-spam, and a way to reach the person).
-- Chats that already exist keep working. Safe to re-run.
create or replace function public.has_verified_email()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_recovery r where r.user_id = (select auth.uid()) and r.email_verified_at is not null);
$$;
revoke execute on function public.has_verified_email() from public, anon;
grant execute on function public.has_verified_email() to authenticated;

create or replace function public.create_business(p_name text, p_handle text, p_category text, p_description text, p_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  bid uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not public.has_verified_email() then raise exception 'email_not_verified'; end if;
  perform public.check_rate('create_business', 5, interval '1 day');
  insert into public.businesses (owner_id, name, handle, category, description, phone)
  values (me, btrim(p_name), nullif(lower(btrim(coalesce(p_handle, ''))), ''), nullif(btrim(coalesce(p_category, '')), ''), nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_phone, '')), ''))
  returning id into bid;
  return bid;
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
    if not public.has_verified_email() then raise exception 'email_not_verified'; end if;
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
