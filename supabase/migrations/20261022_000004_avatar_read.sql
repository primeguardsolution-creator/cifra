-- Profile/logo/product photos live in the public `avatars` bucket. Signed-in users also need SELECT on the
-- objects so a replaced or removed photo can be cleaned up (storage remove/upsert read the row first).
drop policy if exists "avatars: read" on storage.objects;
create policy "avatars: read" on storage.objects for select to authenticated using (bucket_id = 'avatars');

-- make sure realtime really publishes the chat tables
do $$
declare t text;
begin
  foreach t in array array['messages', 'conversation_members', 'message_reactions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
