// Sends a Web Push (RFC 8030/8291/8292, no dependencies) to every device of the people a new message is for.
// Called by the database (pg_net trigger on public.messages) with ?token=<PUSH_TOKEN>. It asks Supabase, with the service role,
// who must be notified and with which title/body (public.push_payloads), encrypts one payload per device and posts it to the
// browser vendor's push service (Apple for iPhone home-screen apps). Dead endpoints (404/410) are removed.
// Env (Netlify, scope Functions): PUSH_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional VAPID_SUBJECT.
import { createCipheriv, createECDH, createPrivateKey, createSign, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url');
const unb64u = (s: string) => Buffer.from(s, 'base64url');

type Row = { endpoint: string; p256dh: string; auth: string; title: string; body: string; icon_path: string | null; conversation_id: string; tag: string };

/** RFC 8291 "aes128gcm" content encryption of `plain` for one browser subscription. */
export function encryptPayload(plain: Buffer, p256dh: string, authSecret: string): Buffer {
  const ua = unb64u(p256dh); const auth = unb64u(authSecret);
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(ua);
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPublic]), 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const data = Buffer.concat([cipher.update(Buffer.concat([plain, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, data]);
}

/** RFC 8292 VAPID: `Authorization: vapid t=<ES256 JWT>, k=<public key>` for the push service that owns `endpoint`. */
export function vapidHeader(endpoint: string, publicKey: string, privateKey: string, subject: string): string {
  const pub = unb64u(publicKey);
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: privateKey }, format: 'jwk' });
  const head = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = createSign('SHA256').update(`${head}.${claims}`).sign({ key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${publicKey}`;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const env = (k: string) => Netlify.env.get(k) ?? '';
  const [token, supabaseUrl, serviceKey, vapidPublic, vapidPrivate] = ['PUSH_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'].map(env);
  if (!token || !supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) return json({ error: 'server_not_configured' }, 503);
  const given = Buffer.from(new URL(req.url).searchParams.get('token') ?? ''); const want = Buffer.from(token);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return json({ error: 'unauthorized' }, 401);

  let messageId = '';
  try { messageId = String(((await req.json()) as { message_id?: string }).message_id ?? ''); } catch { /* handled below */ }
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return json({ error: 'bad_request' }, 400);

  const rest = (fn: string, args: unknown) => fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const res = await rest('push_payloads', { p_message: messageId }).catch(() => null);
  if (!res || !res.ok) return json({ error: 'supabase_error', status: res?.status ?? 'unreachable' }, 502);
  const rows = (await res.json()) as Row[];
  const subject = env('VAPID_SUBJECT') || 'https://cifra-mensajeria.netlify.app';

  let sent = 0; let dropped = 0; let failed = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      const payload = Buffer.from(JSON.stringify({
        title: r.title, body: r.body, tag: r.tag, url: `/chat/${r.conversation_id}`,
        icon: r.icon_path ? `${supabaseUrl}/storage/v1/object/public/avatars/${r.icon_path}` : '/icon-192.png',
      }));
      const out = await fetch(r.endpoint, {
        method: 'POST',
        headers: { authorization: vapidHeader(r.endpoint, vapidPublic, vapidPrivate, subject), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '86400', urgency: 'high' },
        body: encryptPayload(payload, r.p256dh, r.auth),
      });
      if (out.status === 404 || out.status === 410) { dropped++; await rest('drop_push_endpoint', { p_endpoint: r.endpoint }).catch(() => {}); }
      else if (out.ok) sent++; else failed++;
    } catch { failed++; }
  }));
  return json({ ok: true, targets: rows.length, sent, dropped, failed });
};
