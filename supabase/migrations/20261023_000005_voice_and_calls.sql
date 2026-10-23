-- Voice messages + internet calls (WebRTC signaling).
-- Safe to re-run.

-- ── Voice notes: store their length; allow WAV (universal playback) ───────────────────────────────
alter table public.messages add column if not exists attachment_duration_ms integer
  check (attachment_duration_ms is null or attachment_duration_ms between 0 and 3600000);

create or replace function public.before_message_update()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.deleted_at is not null then
    return old;
  end if;
  if new.deleted_at is not null then
    new.body := null;
    new.attachment_path := null;
    new.attachment_type := null;
    new.attachment_name := null;
    new.attachment_size := null;
    new.attachment_duration_ms := null;
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm',
                                  'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'application/pdf', 'text/plain']
 where id = 'chat-media';

-- ── Call signaling over private Realtime channels ─────────────────────────────────────────────────
-- Each person listens ONLY on their own private topic `call:<their user id>`. Nobody can broadcast directly
-- (no INSERT policy); signals are sent through send_call_signal(), which checks that the two people share a
-- personal chat, that neither blocked the other, stamps the sender id server-side and rate-limits.
create or replace function public.can_receive_call_topic(p_topic text)
returns boolean language sql stable security definer set search_path = public as $$
  select (select auth.uid()) is not null and p_topic = 'call:' || (select auth.uid())::text;
$$;

create or replace function public.send_call_signal(p_to uuid, p_event text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_to is null or p_to = me then raise exception 'invalid_peer'; end if;
  if p_event not in ('invite', 'accept', 'offer', 'answer', 'ice', 'decline', 'busy', 'cancel', 'end') then raise exception 'invalid_event'; end if;
  if octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 65536 then raise exception 'payload_too_large'; end if;
  if not public.shares_conversation_with(p_to) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id = me and b.blocked_id = p_to) or (b.blocker_id = p_to and b.blocked_id = me)) then
    raise exception 'forbidden';
  end if;
  perform public.check_rate('call_signal', 600, interval '1 minute');
  perform realtime.send(coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('from', me), p_event, 'call:' || p_to::text, true);
end;
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "calls: receive own signals" on realtime.messages';
    execute $p$create policy "calls: receive own signals" on realtime.messages for select to authenticated
               using (extension = 'broadcast' and public.can_receive_call_topic(realtime.topic()))$p$;
  end if;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
notify pgrst, 'reload schema';
