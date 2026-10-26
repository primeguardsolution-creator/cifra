-- Migration 15: delete my account (required by the app stores and by data-protection rules). One call removes the person, their messages,
-- their contacts, statuses, memberships and the businesses they own alone. Shared conversations stay for the other people.
-- A business with other team members is NOT deleted: the owner must remove the team or hand it over first. Safe to re-run.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  b record;
  c record;
  heir uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  perform public.check_rate('delete_account', 5, interval '1 hour');

  -- businesses: only when nobody else works there (their customers' chats go with them)
  for b in select id from public.businesses where owner_id = me loop
    if exists (select 1 from public.business_members m where m.business_id = b.id and m.user_id <> me) then raise exception 'business_has_team'; end if;
  end loop;
  delete from public.businesses where owner_id = me;

  -- conversations I created: someone else inherits them, or they disappear when I was the only one
  for c in select id from public.conversations where created_by = me loop
    select m.user_id into heir from public.conversation_members m where m.conversation_id = c.id and m.user_id <> me order by m.joined_at nulls last, m.user_id limit 1;
    if heir is null then delete from public.conversations where id = c.id;
    else update public.conversations set created_by = heir where id = c.id;
    end if;
  end loop;

  -- what I wrote
  delete from public.messages where sender_id = me;
  -- the account itself: profile, contacts, memberships, statuses, push devices... go with it (on delete cascade / set null)
  delete from auth.users where id = me;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
