// "Send a test now" from the app: delivers the pending events of one webhook immediately and says what the other side answered.
// Signed-in managers only (their Supabase session is verified and the webhook is read with their own permissions).
import { sweep } from '../lib/integrations.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const env = (k: string) => Netlify.env.get(k) ?? '';
  const [url, anon, key] = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].map(env);
  if (!url || !anon || !key) return json({ error: 'not_configured' }, 503);
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return json({ error: 'unauthorized' }, 401);
  const body = (await req.json().catch(() => null)) as { webhook?: string } | null;
  const webhook = String(body?.webhook ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(webhook)) return json({ error: 'invalid_webhook' }, 400);
  // RLS decides: a non-manager sees no row.
  const mine = await fetch(`${url}/rest/v1/integration_webhooks?id=eq.${webhook}&select=id`, { headers: { authorization, apikey: anon } }).then((r) => (r.ok ? r.json() : [])).catch(() => []) as { id: string }[];
  if (!mine.length) return json({ error: 'forbidden' }, 403);
  const r = await sweep({ url, key }, webhook, 10).catch((e) => ({ tried: 0, ok: 0, error: (e as Error).message }));
  return json(r);
};
