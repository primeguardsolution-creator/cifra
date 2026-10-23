// End-to-end check against the REAL Supabase project: two users register by phone, find each other, chat in real time,
// share a file, and a business serves a customer. Test accounts use +34 699 000 00x (clean up with the SQL printed at the end).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, KEY = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const alias = (e164) => `p${e164.replace(/\D/g, '')}@phone.example.com`;
const run = Date.now().toString().slice(-5);
const phoneA = `+3469900${run.slice(0, 2)}01`, phoneB = `+3469900${run.slice(0, 2)}02`, phoneC = `+3469900${run.slice(0, 2)}03`;

let ok = 0, bad = 0;
const check = async (label, fn) => { try { await fn(); ok++; console.log('  ✓', label); } catch (e) { bad++; console.log('  ✗', label, '\n     ', e.message ?? e); } };
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };

const A = client(), B = client(), C = client();
const signUp = async (c, phone, name) => must(await c.auth.signUp({ email: alias(phone), password: 'Test-Pass-12345', options: { data: { display_name: name } } }));
let a, b, cc, direct, biz, bizChat;

console.log('\nRegistro por teléfono');
await check('Ana, Ben y Cleo se registran y obtienen sesión al instante', async () => {
  a = await signUp(A, phoneA, 'Ana'); b = await signUp(B, phoneB, 'Ben'); cc = await signUp(C, phoneC, 'Cleo');
  if (!a.session || !b.session || !cc.session) throw new Error('no session returned');
});
await check('el perfil se crea con el teléfono (derivado en el servidor)', async () => {
  eq(must(await A.from('profiles').select('phone, phone_verified').eq('id', a.user.id).single()), { phone: phoneA, phone_verified: false });
});
await check('un segundo registro con el mismo número es rechazado', async () => {
  const r = await client().auth.signUp({ email: alias(phoneA), password: 'Otra-Pass-12345' });
  if (!r.error) throw new Error('duplicate phone was accepted');
});
await check('un registro con un correo normal es rechazado (solo teléfono)', async () => {
  const r = await client().auth.signUp({ email: `persona${run}@gmail.com`, password: 'Test-Pass-12345' });
  if (!r.error) throw new Error('plain email was accepted');
});
await check('se puede volver a entrar con número + contraseña', async () => {
  const r = await client().auth.signInWithPassword({ email: alias(phoneA), password: 'Test-Pass-12345' });
  if (r.error) throw r.error;
});

console.log('\nChat en tiempo real');
await check('Ana encuentra a Ben por teléfono y abre un chat (el mismo desde ambos lados)', async () => {
  const found = must(await A.rpc('find_user_by_phone', { p_phone: phoneB.replace('+34', '+34 ') }));
  eq(found[0].display_name, 'Ben');
  direct = must(await A.rpc('start_direct_chat', { p_other: found[0].id }));
  eq(must(await B.rpc('start_direct_chat', { p_other: a.user.id })), direct);
});
await check('Ben recibe el mensaje de Ana por Realtime (<2 s tras activarse)', async () => {
  const got = new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('no realtime event')), 9000);
    B.channel('t').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${direct}` }, (p) => { clearTimeout(t); res(p.new); }).subscribe(async (s) => {
      if (s === 'SUBSCRIBED') { await new Promise((r) => setTimeout(r, 2500)); must(await A.from('messages').insert({ conversation_id: direct, sender_id: a.user.id, body: 'Hola Ben 👋' })); }
    }); });
  eq((await got).body, 'Hola Ben 👋');
});
await check('lista de chats: Ben ve 1 sin leer; tras leer, Ana ve el visto', async () => {
  eq(must(await B.rpc('list_chats', {})).find((x) => x.id === direct).unread, 1);
  must(await B.rpc('mark_read', { p_conv: direct }));
  eq(must(await B.rpc('list_chats', {})).find((x) => x.id === direct).unread, 0);
  const reads = must(await A.from('conversation_members').select('user_id, last_read_at').eq('conversation_id', direct));
  if (!reads.find((r) => r.user_id === b.user.id).last_read_at) throw new Error('read state not visible to Ana');
});
await check('Cleo (ajena) no ve nada de esa conversación', async () => {
  eq(must(await C.from('messages').select('id').eq('conversation_id', direct)).length, 0);
  eq(must(await C.from('profiles').select('id')).length, 1);
});
await check('Ana sube una foto al chat y Ben la ve; Cleo no puede', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==', 'base64');
  const path = `${direct}/test-${run}.png`;
  must(await A.storage.from('chat-media').upload(path, png, { contentType: 'image/png' }));
  const signed = must(await B.storage.from('chat-media').createSignedUrl(path, 60));
  const res = await fetch(signed.signedUrl); if (!res.ok) throw new Error('Ben could not download: ' + res.status);
  const denied = await C.storage.from('chat-media').createSignedUrl(path, 60);
  if (!denied.error) throw new Error('Cleo got a signed URL');
});
await check('foto de perfil: Ana sube su avatar a su carpeta y no puede escribir en la de Ben', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==', 'base64');
  must(await A.storage.from('avatars').upload(`${a.user.id}/avatar.png`, png, { contentType: 'image/png', upsert: true }));
  must(await A.storage.from('avatars').remove([`${a.user.id}/avatar.png`]));
  must(await A.storage.from('avatars').upload(`${a.user.id}/avatar.png`, png, { contentType: 'image/png' }));
  must(await A.from('profiles').update({ avatar_path: `${a.user.id}/avatar.png` }).eq('id', a.user.id).select().single());
  const bad = await A.storage.from('avatars').upload(`${b.user.id}/hack.png`, png, { contentType: 'image/png' });
  if (!bad.error) throw new Error('Ana wrote into Ben folder');
  const url = A.storage.from('avatars').getPublicUrl(`${a.user.id}/avatar.png`).data.publicUrl;
  if (!(await fetch(url)).ok) throw new Error('avatar not publicly readable');
});

console.log('\nBusiness');
await check('Cleo crea su negocio con logo; Ana lo encuentra, ve el catálogo y le escribe', async () => {
  biz = must(await C.rpc('create_business', { p_name: `Café Prueba ${run}`, p_handle: `cafe-${run}`, p_category: 'Restauración', p_description: 'Café', p_phone: phoneC }));
  must(await C.from('catalog_items').insert({ business_id: biz, name: 'Flat white', price_minor: 350, currency: 'EUR', is_published: true }));
  must(await C.from('businesses').update({ greeting: '¡Hola! ¿En qué te ayudamos?', logo_path: `business/${biz}/logo.png` }).eq('id', biz).select().single());
  const hit = must(await A.rpc('search_businesses', { p_query: `cafe-${run}` }));
  eq(hit[0].id, biz);
  eq(must(await A.rpc('get_business_public', { p_id: biz })).catalog.length, 1);
  bizChat = must(await A.rpc('start_business_chat', { p_business: biz }));
  must(await A.from('messages').insert({ conversation_id: bizChat, sender_id: a.user.id, body: '¿Abrís hoy?' }));
});
await check('saludo automático entregado a la clienta', async () => {
  const msgs = must(await A.from('messages').select('body, is_automated').eq('conversation_id', bizChat).order('created_at'));
  eq(msgs.map((m) => m.is_automated), [false, true]);
});
await check('el equipo ve la bandeja; Ben (ajeno) no; una nota interna no llega a la clienta', async () => {
  eq(must(await C.rpc('list_chats', { p_business: biz })).length, 1);
  const r = await B.rpc('list_chats', { p_business: biz }); if (!r.error) throw new Error('Ben read the inbox');
  must(await C.rpc('mark_read', { p_conv: bizChat }));
  must(await C.from('messages').insert({ conversation_id: bizChat, sender_id: cc.user.id, body: 'clienta habitual', is_internal: true }));
  eq(must(await A.from('messages').select('id').eq('conversation_id', bizChat).eq('is_internal', true)).length, 0);
});
await check('Cleo añade a Ben al equipo por su número y él ya ve la bandeja', async () => {
  must(await C.rpc('add_business_member', { p_business: biz, p_phone: phoneB, p_role: 'agent' }));
  eq(must(await B.rpc('list_chats', { p_business: biz })).length, 1);
});

console.log(`\n${ok} correctas, ${bad} fallidas`);
console.log(`\nLimpieza (SQL Editor):  delete from auth.users where email like 'p3469900${run.slice(0, 2)}0%@phone.example.com';`);
process.exit(bad ? 1 : 0);
