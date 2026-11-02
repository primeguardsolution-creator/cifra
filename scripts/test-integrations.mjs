// Tests of the integration plumbing: signing, SSRF protection, one delivery, and the public API (with a fake database).
import { createHmac, createHash } from 'node:crypto';
const { signBody, isPrivateAddress, assertSafeUrl, deliver } = await import('../netlify/lib/integrations.ts');
let passed = 0, failed = 0;
const check = async (label, fn) => { try { await fn(); passed++; console.log(`  ✓ ${label}`); } catch (e) { failed++; console.log(`  ✗ ${label}\n      ${e.message}`); } };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };

await check('la firma es HMAC-SHA256 de "timestamp.cuerpo"', () => {
  const expected = 'sha256=' + createHmac('sha256', 's3cret').update('1700000000.{"a":1}').digest('hex');
  eq(signBody('s3cret', '1700000000', '{"a":1}'), expected);
});
await check('direcciones privadas bloqueadas', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '224.0.0.1']) eq(isPrivateAddress(ip), true, ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111']) eq(isPrivateAddress(ip), false, ip);
});
await check('solo https y solo hosts públicos', async () => {
  const pub = async () => [{ address: '93.184.216.34' }];
  await assertSafeUrl('https://hook.example.com/x', pub);
  for (const bad of ['http://hook.example.com', 'https://user:pw@hook.example.com', 'https://localhost/x', 'https://10.0.0.1/x', 'https://[::1]/x', 'ftp://x.example.com', 'no es url', 'https://metadata.internal/x']) {
    let err = null; try { await assertSafeUrl(bad, pub); } catch (e) { err = e.message; }
    if (!err) throw new Error(`${bad} should be rejected`);
  }
  let rebinding = null; try { await assertSafeUrl('https://evil.example.com', async () => [{ address: '93.184.216.34' }, { address: '10.0.0.8' }]); } catch (e) { rebinding = e.message; }
  eq(rebinding, 'private_address', 'a host that also resolves to a private address');
});
await check('entrega: cabeceras firmadas, sin seguir redirecciones, errores clasificados', async () => {
  const seen = [];
  const lookup = async () => [{ address: '93.184.216.34' }];
  const row = { id: 'd1', webhook_id: 'w1', event: 'customer.created', payload: { x: 1 }, attempts: 1, url: 'https://hook.example.com/x', secret: 'k' };
  const ok = await deliver(row, { lookup, now: () => 1700000000000, fetchImpl: async (u, init) => { seen.push({ u: String(u), init }); return new Response('ok', { status: 200 }); } });
  eq(ok, { ok: true, code: 200, error: null });
  const h = seen[0].init.headers;
  eq([h['x-cifra-event'], h['x-cifra-delivery'], h['x-cifra-timestamp'], seen[0].init.redirect], ['customer.created', 'd1', '1700000000', 'manual']);
  eq(h['x-cifra-signature'], signBody('k', '1700000000', '{"x":1}'));
  eq((await deliver(row, { lookup, fetchImpl: async () => new Response('no', { status: 500 }) })), { ok: false, code: 500, error: 'HTTP 500' });
  eq((await deliver(row, { lookup, fetchImpl: async () => new Response('', { status: 302 }) })).ok, false, '3xx is not success');
  eq((await deliver(row, { lookup, fetchImpl: async () => { throw new Error('ECONNREFUSED'); } })), { ok: false, code: 0, error: 'connection_failed' });
  eq((await deliver({ ...row, url: 'https://10.0.0.1/x' }, { lookup, fetchImpl: async () => { throw new Error('must not be called'); } })).error, 'private_address');
});

// ── public API, against a fake PostgREST
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
globalThis.Netlify = { env: { get: (k) => env[k] } };
const KEY = 'cifra_' + 'a'.repeat(64); const HASH = createHash('sha256').update(KEY).digest('hex');
const calls = [];
globalThis.fetch = async (u, init) => {
  const fn = String(u).split('/rpc/')[1]; const args = JSON.parse(init.body); calls.push([fn, args]);
  if (fn === 'api_key_auth') return new Response(JSON.stringify(args.p_hash === HASH ? 'biz-1' : null));
  if (fn === 'api_upsert_customer') { if (args.p_stage === 'vip') return new Response('invalid_stage', { status: 400 }); return new Response(JSON.stringify({ id: 'c1', created: !args.p_email, customer: {} })); }
  if (fn === 'api_create_task') return new Response(JSON.stringify('t1'));
  return new Response('?', { status: 404 });
};
const { default: api } = await import('../netlify/functions/v1.mts');
const call = (path, { method = 'POST', body, token = KEY } = {}) => api(new Request('https://x.test' + path, { method, headers: { authorization: token ? `Bearer ${token}` : '' }, body: body ? JSON.stringify(body) : undefined }));
await check('API: sin clave o con clave falsa -> 401', async () => {
  eq((await call('/api/v1/ping', { method: 'GET', token: '' })).status, 401);
  eq((await call('/api/v1/ping', { method: 'GET', token: 'cifra_' + 'b'.repeat(64) })).status, 401);
  eq((await call('/api/v1/ping', { method: 'GET', token: 'nope' })).status, 401);
});
await check('API: ping, crear cliente (201), actualizar (200), valores normalizados', async () => {
  eq(await (await call('/api/v1/ping', { method: 'GET' })).json(), { ok: true, business: 'biz-1' });
  const r = await call('/api/v1/customers', { body: { name: '  Ana ', phone: '+34 600', stage: 'lead', tags: ['VIP!', 'web', 5], value: 12.5 } });
  eq(r.status, 201);
  const a = calls.filter(([f]) => f === 'api_upsert_customer').pop()[1];
  eq([a.p_business, a.p_name, a.p_tags, a.p_value_minor], ['biz-1', 'Ana', ['vip', 'web'], 1250]);
  eq((await call('/api/v1/customers', { body: { email: 'a@b.co' } })).status, 200);
});
await check('API: errores de validación -> 400, rutas desconocidas -> 404', async () => {
  eq((await call('/api/v1/customers', { body: { name: 'X', stage: 'vip' } })).status, 400);
  eq((await call('/api/v1/tasks', { body: { title: 'Llamar', due_at: 'mañana' } })).status, 400);
  eq((await call('/api/v1/tasks', { body: { title: 'Llamar', due_at: '2030-01-01T10:00:00Z' } })).status, 201);
  eq((await call('/api/v1/nada', { body: {} })).status, 404);
});
await check('API: límite de 60 peticiones por minuto', async () => {
  let last = 200; for (let i = 0; i < 70; i++) last = (await call('/api/v1/ping', { method: 'GET' })).status;
  eq(last, 429);
});

console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
