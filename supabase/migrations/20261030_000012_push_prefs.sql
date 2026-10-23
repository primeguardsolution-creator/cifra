-- Migration 12: notifications are chosen per space. Each device can receive personal notifications, Business notifications,
-- both, or none; Business ones carry a briefcase in the title and their own tag so they never replace a personal one.
alter table public.push_subscriptions add column if not exists notify_personal boolean not null default true;
alter table public.push_subscriptions add column if not exists notify_business boolean not null default true;

create or replace function public.get_push_prefs(p_endpoint text)
returns table (notify_personal boolean, notify_business boolean)
language sql security definer stable set search_path = public as $$
  select s.notify_personal, s.notify_business from public.push_subscriptions s where s.endpoint = p_endpoint and s.user_id = (select auth.uid());
$$;

create or replace function public.set_push_prefs(p_endpoint text, p_personal boolean, p_business boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  update public.push_subscriptions set notify_personal = coalesce(p_personal, notify_personal), notify_business = coalesce(p_business, notify_business)
   where endpoint = p_endpoint and user_id = (select auth.uid());
end;
$$;
revoke execute on function public.get_push_prefs(text), public.set_push_prefs(text, boolean, boolean) from public, anon;
grant execute on function public.get_push_prefs(text), public.set_push_prefs(text, boolean, boolean) to authenticated;

drop function if exists public.push_payloads(uuid);
create or replace function public.push_payloads(p_message uuid)
returns table (endpoint text, p256dh text, auth text, title text, body text, icon_path text, conversation_id uuid, tag text)
language plpgsql security definer set search_path = public as $q$
#variable_conflict use_column
declare
  m public.messages;
  c public.conversations;
  b public.businesses;
  sender public.profiles;
begin
  select * into m from public.messages where id = p_message;
  if m.id is null or m.deleted_at is not null or m.is_internal then return; end if;
  select * into c from public.conversations where id = m.conversation_id;
  select * into sender from public.profiles where id = m.sender_id;
  if c.business_id is not null then select * into b from public.businesses where id = c.business_id; end if;
  return query
  with recipients as (
    -- direct, group and the customer side of a business chat
    select cm.user_id, cm.muted_until, false as biz from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id <> m.sender_id
    union
    -- a customer wrote to the business: the assigned agent, or every agent when nobody is assigned
    select bm.user_id, null::timestamptz, true from public.business_members bm
     where c.kind = 'business' and m.sender_id = c.customer_id and bm.business_id = c.business_id and bm.role in ('owner', 'admin', 'supervisor', 'agent')
       and bm.user_id <> m.sender_id and (c.assigned_to is null or bm.user_id = c.assigned_to)
  ), eligible as (
    select r.user_id, r.biz, p.locale, coalesce((select k.display_name from public.contacts k where k.owner_id = r.user_id and k.contact_user_id = m.sender_id limit 1), sender.display_name) as sender_name
      from recipients r join public.profiles p on p.id = r.user_id
     where (r.muted_until is null or r.muted_until < now())
       and not exists (select 1 from public.user_blocks ub where (ub.blocker_id = r.user_id and ub.blocked_id = m.sender_id) or (ub.blocker_id = m.sender_id and ub.blocked_id = r.user_id))
  )
  select s.endpoint, s.p256dh, s.auth,
         case when c.incognito then 'CIFRA'
              when c.kind = 'business' and m.sender_id = c.customer_id then chr(128188) || ' ' || e.sender_name || ' ' || chr(183) || ' ' || b.name
              when c.kind = 'business' then b.name
              when c.kind = 'group' then coalesce(c.title, 'CIFRA')
              else e.sender_name end,
         left(case
                when c.incognito then public.push_label(e.locale, 'new')
                else (case when c.kind in ('group') or (c.kind = 'business' and m.sender_id <> c.customer_id and not m.is_automated) then e.sender_name || ': ' else '' end)
                     || case
                          when m.body like chr(128197) || '%' then public.push_label(e.locale, 'appt')
                          when m.body like chr(128222) || '%' or m.body like chr(128249) || '%' then public.push_label(e.locale, 'call')
                          when coalesce(btrim(m.body), '') <> '' then m.body
                          when m.attachment_type like 'image%' then public.push_label(e.locale, 'image')
                          when m.attachment_type like 'video%' then public.push_label(e.locale, 'video')
                          when m.attachment_type like 'audio%' then public.push_label(e.locale, 'audio')
                          else public.push_label(e.locale, 'file') end
              end, 160),
         case when c.incognito then null when c.kind = 'business' and m.sender_id <> c.customer_id then coalesce(b.logo_path, sender.avatar_path) else sender.avatar_path end,
         c.id, case when e.biz then 'biz-' else 'chat-' end || c.id::text
    from eligible e join public.push_subscriptions s on s.user_id = e.user_id
   where case when e.biz then s.notify_business else s.notify_personal end;
end;
$q$;
revoke all on function public.push_payloads(uuid) from public, anon, authenticated;
grant execute on function public.push_payloads(uuid) to service_role;
