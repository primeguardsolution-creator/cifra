// Live check of call signaling: private Realtime channel + send_call_signal, and voice-note storage.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const mk = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = Date.now().toString().slice(-5);
const ph = (n) => `+3469901${run.slice(0, 3)}${n}`;
const alias = (e) => `p${e.replace(/\D/g, '')}@phone.example.com`;
let ok = 0, bad = 0;
const check = async (l, f) => { try { await f(); ok++; console.log('  ✓', l); } catch (e) { bad++; console.log('  ✗', l, '\n     ', e.message ?? e); } };
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const A = mk(), B = mk(), C = mk();
const up = async (c, p, n) => must(await c.auth.signUp({ email: alias(p), password: 'Test-Pass-12345', options: { data: { display_name: n } } }));
const a = await up(A, ph('01'), 'Ana'), b = await up(B, ph('02'), 'Ben'), cc = await up(C, ph('03'), 'Cleo');
const conv = must(await A.rpc('start_direct_chat', { p_other: b.user.id }));

console.log('\nLlamadas: señalización privada');
await check('Ben recibe la invitación de Ana en su canal privado, con el remitente estampado por el servidor', async () => {
  await B.realtime.setAuth();
  const got = new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('no broadcast received')), 10000);
    const ch = B.channel(`call:${b.user.id}`, { config: { private: true } });
    ch.on('broadcast', { event: 'invite' }, ({ payload }) => { clearTimeout(t); res(payload); });
    ch.subscribe(async (s) => { if (s === 'SUBSCRIBED') { await new Promise((r) => setTimeout(r, 1500)); must(await A.rpc('send_call_signal', { p_to: b.user.id, p_event: 'invite', p_payload: { callId: 'abc', kind: 'video', from: cc.user.id } })); } if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') rej(new Error('channel ' + s)); });
  });
  const p = await got;
  if (p.from !== a.user.id || p.callId !== 'abc' || p.kind !== 'video') throw new Error('bad payload ' + JSON.stringify(p));
});
await check('Cleo no puede escuchar el canal privado de Ben', async () => {
  await C.realtime.setAuth();
  const res = await new Promise((resolve) => { const ch = C.channel(`call:${b.user.id}`, { config: { private: true } }); const t = setTimeout(() => resolve('no-join'), 6000); ch.subscribe((s) => { if (s === 'SUBSCRIBED') { clearTimeout(t); resolve('joined'); } if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') { clearTimeout(t); resolve('denied'); } }); });
  if (res === 'joined') throw new Error("Cleo joined Ben's private channel");
});
await check('Cleo (sin chat con Ben) no puede llamarle', async () => {
  const r = await C.rpc('send_call_signal', { p_to: b.user.id, p_event: 'invite', p_payload: {} }); if (!r.error) throw new Error('stranger could ring');
});

console.log('\nMensaje de voz');
await check('Ana sube un audio WAV con duración y Ben lo descarga', async () => {
  const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([36, 0, 0, 0]), Buffer.from('WAVEfmt '), Buffer.from([16, 0, 0, 0, 1, 0, 1, 0, 0x80, 0x3e, 0, 0, 0, 0x7d, 0, 0, 2, 0, 16, 0]), Buffer.from('data'), Buffer.from([0, 0, 0, 0])]);
  const path = `${conv}/voz-${run}.wav`;
  must(await A.storage.from('chat-media').upload(path, wav, { contentType: 'audio/wav' }));
  must(await A.from('messages').insert({ conversation_id: conv, sender_id: a.user.id, attachment_path: path, attachment_type: 'audio/wav', attachment_name: 'voz.wav', attachment_size: wav.length, attachment_duration_ms: 3200 }).select().single());
  const row = must(await B.from('messages').select('attachment_duration_ms, attachment_type').eq('conversation_id', conv).single());
  if (row.attachment_duration_ms !== 3200) throw new Error('duration lost');
  const url = must(await B.storage.from('chat-media').createSignedUrl(path, 60)).signedUrl;
  if (!(await fetch(url)).ok) throw new Error('download failed');
});

console.log(`\n${ok} correctas, ${bad} fallidas`);
console.log(`phones: ${ph('01')} ${ph('02')} ${ph('03')}`);
process.exit(bad ? 1 : 0);
