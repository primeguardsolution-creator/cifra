// CIFRA public API for automation (Make, Zapier, n8n, scripts). Authorization: Bearer cifra_<key> (created in Business -> Integrations).
//   GET  /api/v1/ping       -> { ok, business }
//   POST /api/v1/customers  -> create or update a customer (matched by phone, then e-mail)
//   POST /api/v1/tasks      -> create a CRM task
import { createHash } from 'node:crypto';
import { rpc } from '../lib/integrations.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const hits = new Map<string, { n: number; t: number }>();
const limited = (id: string) => { const now = Date.now(); const h = hits.get(id); if (!h || now - h.t > 60_000) { hits.set(id, { n: 1, t: now }); return false; } h.n++; return h.n > 60; };
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export default async (req: Request) => {
  const env = (k: string) => Netlify.env.get(k) ?? '';
  const [url, key] = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map(env);
  if (!url || !key) return json({ error: 'not_configured' }, 503);
  const token = (req.headers.get('authorization') ?? '').replace(/^bearer\s+/i, '').trim();
  if (!/^cifra_[0-9a-f]{64}$/.test(token)) return json({ error: 'unauthorized' }, 401);
  const hash = createHash('sha256').update(token).digest('hex');
  const business = await rpc<string | null>('api_key_auth', { p_hash: hash }, { url, key }).catch(() => null);
  if (!business) return json({ error: 'unauthorized' }, 401);
  if (limited(hash)) return json({ error: 'rate_limited' }, 429);

  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const db = { url, key };
  try {
    if (path.endsWith('/ping') && req.method === 'GET') return json({ ok: true, business });
    const body = req.method === 'POST' ? ((await req.json().catch(() => null)) as Record<string, unknown> | null) : null;
    if (path.endsWith('/customers') && req.method === 'POST' && body) {
      const value = typeof body.value_minor === 'number' ? Math.round(body.value_minor) : typeof body.value === 'number' ? Math.round(body.value * 100) : null;
      const tags = Array.isArray(body.tags) ? body.tags.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase().replace(/[^a-z0-9áéíóúñ_-]/g, '').slice(0, 20)).filter(Boolean).slice(0, 20) : null;
      const r = await rpc<{ id: string; created: boolean; customer: unknown }>('api_upsert_customer', { p_business: business, p_name: str(body.name, 120), p_phone: str(body.phone, 40), p_email: str(body.email, 200), p_stage: str(body.stage, 20), p_tags: tags, p_notes: str(body.notes, 4000), p_value_minor: value !== null && value >= 0 ? value : null }, db);
      return json(r, r.created ? 201 : 200);
    }
    if (path.endsWith('/tasks') && req.method === 'POST' && body) {
      const due = str(body.due_at, 40);
      if (due && Number.isNaN(Date.parse(due))) return json({ error: 'invalid_due_at' }, 400);
      const id = await rpc<string>('api_create_task', { p_business: business, p_customer: str(body.customer_id, 36), p_title: str(body.title, 200), p_due: due }, db);
      return json({ id }, 201);
    }
    return json({ error: 'not_found' }, 404);
  } catch (e) {
    const m = (e as Error).message;
    const known = /invalid_stage|name_required|title_required|customer_not_found|customer_limit/.exec(m)?.[0];
    return known ? json({ error: known }, known === 'customer_limit' ? 429 : 400) : json({ error: 'failed' }, 500);
  }
};

export const config = { path: ['/api/v1/ping', '/api/v1/customers', '/api/v1/tasks'] };
