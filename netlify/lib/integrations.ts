// Shared by the integration functions: signing, URL safety (no calls into private networks) and one delivery attempt.
import { createHmac } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';

export type Delivery = { id: string; webhook_id: string; event: string; payload: unknown; attempts: number; url: string; secret: string };
export type Lookup = (host: string) => Promise<{ address: string }[]>;

/** `X-Cifra-Signature: sha256=<hex>` = HMAC-SHA256(secret, `${timestamp}.${body}`). */
export const signBody = (secret: string, timestamp: string, body: string) => `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;

export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.includes(':')) {
    const mapped = v.startsWith('::ffff:') ? v.slice(7) : null;
    if (mapped && mapped.includes('.')) return isPrivateAddress(mapped);
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
  }
  const p = v.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Throws unless `raw` is an https URL whose host resolves only to public addresses. */
export async function assertSafeUrl(raw: string, lookup: Lookup = (h) => dnsLookup(h, { all: true })): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('invalid_url'); }
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('invalid_url');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('private_address');
  const addrs = /^[\d.]+$/.test(host) || host.includes(':') ? [{ address: host }] : await lookup(host);
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('private_address');
  return u;
}

/** One POST of one delivery. Never throws: the result says what to report back to the database. */
export async function deliver(d: Delivery, opts: { fetchImpl?: typeof fetch; lookup?: Lookup; now?: () => number } = {}): Promise<{ ok: boolean; code: number; error: string | null }> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const url = await assertSafeUrl(d.url, opts.lookup);
    const body = JSON.stringify(d.payload);
    const ts = String(Math.floor((opts.now?.() ?? Date.now()) / 1000));
    const res = await f(url, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
      headers: { 'content-type': 'application/json', 'user-agent': 'CIFRA-Webhooks/1', 'x-cifra-event': d.event, 'x-cifra-delivery': d.id, 'x-cifra-timestamp': ts, 'x-cifra-signature': signBody(d.secret, ts, body) },
      body,
    });
    const ok = res.status >= 200 && res.status < 300;
    return { ok, code: res.status, error: ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, code: 0, error: m === 'private_address' || m === 'invalid_url' ? m : /timeout|abort/i.test(m) ? 'timeout' : 'connection_failed' };
  }
}

/** Service-role call to a Postgres function through PostgREST. */
export async function rpc<T>(fn: string, args: unknown, env: { url: string; key: string }): Promise<T> {
  const res = await fetch(`${env.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: env.key, authorization: `Bearer ${env.key}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 300) || `rpc_${res.status}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Claims what is due and delivers it (a few at a time, in parallel). Returns how many were tried. */
export async function sweep(env: { url: string; key: string }, webhook: string | null = null, limit = 25, opts: Parameters<typeof deliver>[1] = {}): Promise<{ tried: number; ok: number; last?: { code: number; error: string | null } }> {
  const rows = await rpc<Delivery[]>('claim_deliveries', { p_limit: limit, p_webhook: webhook }, env);
  let ok = 0; let last: { code: number; error: string | null } | undefined;
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(rows.slice(i, i + 5).map(async (d) => {
      const r = await deliver(d, opts);
      if (r.ok) ok++;
      last = { code: r.code, error: r.error };
      await rpc('report_delivery', { p_id: d.id, p_ok: r.ok, p_code: r.code, p_error: r.error }, env).catch(() => {});
    }));
  }
  return { tried: rows.length, ok, last };
}
