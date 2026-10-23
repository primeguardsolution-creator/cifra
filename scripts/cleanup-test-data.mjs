// Removes the storage files of the throw-away test accounts (+34 699 0xx xxx) created by e2e-live.mjs and manual testing.
// Rows are removed with the SQL printed at the end (Storage objects can only be deleted through the Storage API).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const phones = process.argv.slice(2);
if (!phones.length) { console.log('usage: node scripts/cleanup-test-data.mjs +34699005301 +34699005302 …'); process.exit(1); }
let removed = 0;
for (const p of phones) {
  const c = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: `p${p.replace(/\D/g, '')}@phone.example.com`, password: 'Test-Pass-12345' });
  if (error) { console.log('skip', p, error.message); continue; }
  const uid = data.user.id;
  const sweep = async (bucket, folder) => {
    const { data: files } = await c.storage.from(bucket).list(folder, { limit: 1000 });
    const names = (files ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
    if (names.length) { await c.storage.from(bucket).remove(names); removed += names.length; }
  };
  await sweep('avatars', uid);
  await sweep('chat-media', `status/${uid}`);
  const { data: chats } = await c.rpc('list_chats', {});
  for (const ch of chats ?? []) await sweep('chat-media', ch.id);
  const { data: biz } = await c.from('business_members').select('business_id');
  for (const b of biz ?? []) await sweep('avatars', `business/${b.business_id}`);
}
console.log(`removed ${removed} files`);
console.log(`\nNow run in the SQL Editor:\n
delete from public.businesses where owner_id in (select id from auth.users where email ~ '^p346990[0-9]{5}@phone\\.example\\.com$');
delete from public.conversations where created_by in (select id from auth.users where email ~ '^p346990[0-9]{5}@phone\\.example\\.com$');
delete from public.messages where sender_id in (select id from auth.users where email ~ '^p346990[0-9]{5}@phone\\.example\\.com$');
delete from auth.users where email ~ '^p346990[0-9]{5}@phone\\.example\\.com$';`);
