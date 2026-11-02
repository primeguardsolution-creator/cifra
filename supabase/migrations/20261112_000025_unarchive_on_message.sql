-- Migration 25: an archived chat comes back to the list when something new arrives (unless it is muted), and when you write in it yourself.
-- Before this, archived chats stayed hidden and new messages could go unseen. Safe to re-run.
create or replace function public.unarchive_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_internal then return new; end if;
  update public.conversation_members cm set archived = false
  where cm.conversation_id = new.conversation_id and cm.archived
    and (cm.user_id = new.sender_id or cm.muted_until is null or cm.muted_until <= now());
  return new;
exception when others then return new;
end;
$$;
revoke all on function public.unarchive_on_message() from public, anon, authenticated;
drop trigger if exists messages_unarchive on public.messages;
create trigger messages_unarchive after insert on public.messages for each row execute function public.unarchive_on_message();
