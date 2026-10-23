// Exercises netlify/functions/push.mts end to end with local mocks: a fake Supabase (push_payloads / drop_push_endpoint) and a fake
// browser push service that decrypts the payload exactly like a phone would (RFC 8291) and verifies the VAPID signature (RFC 8292).
import { createDecipheriv, createECDH, createPublicKey, createVerify, hkdfSync, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const proj = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'push-fn-'));
writeFileSync(join(out, 'push.mjs'), ts.transpileModule(readFileSync(join(proj, 'netlify/functions/push.mts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);

let failed = 0;
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) failed++; };
const b64u = (b) => Buffer.from(b).toString('base64url');

// VAPID key pair (what the owner generates once)
const vapid = createECDH('prime256v1'); vapid.generateKeys();
const VAPID_PUBLIC = b64u(vapid.getPublicKey()); const VAPID_PRIVATE = b64u(vapid.getPrivateKey());
// the "phone"
const ua = createECDH('prime256v1'); ua.generateKeys(); const uaAuth = randomBytes(16);
const sub = { endpoint: 'https://push.example.test/send/abc', p256dh: b64u(ua.getPublicKey()), auth: b64u(uaAuth) };

const env = { PUSH_TOKEN: 'secret-token', SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'service', VAPID_PUBLIC_KEY: VAPID_PUBLIC, VAPID_PRIVATE_KEY: VAPID_PRIVATE };
globalThis.Netlify = { env: { get: (k) => env[k] } };

const calls = { rpc: [], push: [], dropped: [] };
let pushStatus = 201; let rows = [];
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url.startsWith('https://sb.test/rest/v1/rpc/push_payloads')) { calls.rpc.push(JSON.parse(init.body)); return new Response(JSON.stringify(rows), { status: 200 }); }
  if (url.startsWith('https://sb.test/rest/v1/rpc/reminder_payloads')) { calls.rpc.push({ reminder: JSON.parse(init.body).p_appt }); return new Response(JSON.stringify(rows), { status: 200 }); }
  if (url.startsWith('https://sb.test/rest/v1/rpc/drop_push_endpoint')) { calls.dropped.push(JSON.parse(init.body).p_endpoint); return new Response('null', { status: 200 }); }
  if (url.startsWith('https://push.example.test/')) { calls.push.push({ url, headers: init.headers, body: Buffer.from(init.body) }); return new Response(null, { status: pushStatus }); }
  return new Response('not found', { status: 404 });
};

const { default: handler, encryptPayload, vapidHeader } = await import(pathToFileURL(join(out, 'push.mjs')).href);
const post = (token, body, method = 'POST') => handler(new Request(`https://cifra.test/api/push?token=${token}`, { method, body: method === 'GET' || body === undefined ? undefined : JSON.stringify(body) }));

// receiver side of RFC 8291
function decrypt(body) {
  const salt = body.subarray(0, 16); const idlen = body[20]; const asPublic = body.subarray(21, 21 + idlen); const data = body.subarray(21 + idlen);
  const shared = ua.computeSecret(asPublic);
  const ikm = Buffer.from(hkdfSync('sha256', shared, uaAuth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return plain.subarray(0, plain.lastIndexOf(2)).toString('utf8');
}

console.log('Web Push (netlify/functions/push.mts)');
const msg = '00000000-0000-4000-8000-000000000001';
ok((await post('wrong', { message_id: msg })).status === 401, 'token incorrecto → 401');
ok((await post('secret-token', { message_id: msg }, 'GET')).status === 405, 'GET → 405');
ok((await post('secret-token', { message_id: 'nope' })).status === 400, 'message_id inválido → 400');
env.PUSH_TOKEN = ''; ok((await post('x', { message_id: msg })).status === 503, 'sin configurar → 503'); env.PUSH_TOKEN = 'secret-token';

rows = [{ ...sub, title: 'Eva · Café Aurora', body: 'Hola, ¿tenéis mesa? 😀', icon_path: 'abc/avatar.jpg', conversation_id: '11111111-1111-4111-8111-111111111111', tag: 'chat-1' }];
const res = await post('secret-token', { message_id: msg });
const j = await res.json();
ok(res.status === 200 && j.sent === 1 && j.targets === 1, 'envía una notificación por dispositivo');
ok(calls.rpc[0]?.p_message === msg, 'pide a Supabase los datos del mensaje');
const sent = calls.push[0];
ok(sent && sent.headers['content-encoding'] === 'aes128gcm' && sent.headers.ttl === '86400', 'cabeceras Web Push (aes128gcm, TTL)');
const payload = JSON.parse(decrypt(sent.body));
ok(payload.title === 'Eva · Café Aurora' && payload.body === 'Hola, ¿tenéis mesa? 😀' && payload.url === '/chat/11111111-1111-4111-8111-111111111111' && payload.tag === 'chat-1', 'el teléfono descifra título, texto, destino y etiqueta (con acentos y emoji)');
ok(payload.icon === 'https://sb.test/storage/v1/object/public/avatars/abc/avatar.jpg', 'icono = foto de quien escribe');
const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(sent.headers.authorization);
const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
const pubKey = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(vapid.getPublicKey().subarray(1, 33)), y: b64u(vapid.getPublicKey().subarray(33, 65)) }, format: 'jwk' });
ok(createVerify('SHA256').update(`${m[1]}.${m[2]}`).verify({ key: pubKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')) && m[4] === VAPID_PUBLIC, 'firma VAPID válida (ES256) y clave pública');
ok(claims.aud === 'https://push.example.test' && claims.exp > Date.now() / 1000 && claims.exp < Date.now() / 1000 + 13 * 3600, 'VAPID: audiencia = servicio de push y caducidad ≤ 12 h');
ok(encryptPayload(Buffer.from('x'), sub.p256dh, sub.auth).equals(encryptPayload(Buffer.from('x'), sub.p256dh, sub.auth)) === false, 'cada envío usa sal y clave efímera nuevas');

pushStatus = 410; calls.push.length = 0;
const gone = await (await post('secret-token', { message_id: msg })).json();
ok(gone.dropped === 1 && calls.dropped[0] === sub.endpoint, 'endpoint caducado (410) → se borra de la base de datos');
pushStatus = 500; const bad = await (await post('secret-token', { message_id: msg })).json();
ok(bad.failed === 1 && bad.sent === 0, 'error del servicio de push → cuenta como fallo, no rompe');
rows = []; const none = await (await post('secret-token', { message_id: msg })).json();
ok(none.targets === 0 && none.sent === 0, 'sin destinatarios suscritos → no envía nada');
// appointment reminder: same delivery, its own destination
const appt = '22222222-2222-4222-8222-222222222222'; pushStatus = 201; calls.push.length = 0; calls.rpc.length = 0;
rows = [{ ...sub, title: '\u23F0 Revision', body: 'En 5 minutos \u00B7 10:30 \u00B7 Cafe Aurora', icon_path: null, conversation_id: null, tag: 'appt-1', url: '/agenda' }];
const rem = await (await post('secret-token', { appointment_id: appt })).json();
ok(rem.sent === 1 && calls.rpc[0]?.reminder === appt, 'recordatorio de cita: pide reminder_payloads');
const rp = JSON.parse(decrypt(calls.push[0].body));
ok(rp.url === '/agenda' && rp.tag === 'appt-1' && rp.title.endsWith('Revision'), 'el recordatorio abre la agenda y lleva su propia etiqueta');
ok((await post('secret-token', { appointment_id: 'nope' })).status === 400, 'appointment_id inválido → 400');
process.exit(failed ? 1 : 0);
