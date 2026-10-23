// Deploy notification -> one row in public.app_releases, so every open CIFRA tab learns at once (Supabase realtime)
// that a new version is live. Wire it in Netlify: Site configuration -> Notifications -> Deploy succeeded -> Outgoing
// webhook -> https://<site>/api/release?token=<RELEASE_TOKEN>. Needs RELEASE_TOKEN, SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY (scope Functions). Without them it answers 503 and the app falls back to checking on open.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(req.url);
  const token = Netlify.env.get('RELEASE_TOKEN');
  const supabaseUrl = Netlify.env.get('SUPABASE_URL');
  const serviceKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !supabaseUrl || !serviceKey) return json({ error: 'server_not_configured' }, 503);
  if (url.searchParams.get('token') !== token) return json({ error: 'unauthorized' }, 401);

  let payload: { id?: string; commit_ref?: string; title?: string; branch?: string } = {};
  try { payload = (await req.json()) as typeof payload; } catch { /* Netlify always sends JSON; tolerate manual calls */ }
  if (payload.branch && payload.branch !== 'main') return json({ skipped: 'not_production', branch: payload.branch });
  const build = payload.id ?? payload.commit_ref ?? String(Date.now());
  const res = await fetch(`${supabaseUrl}/rest/v1/app_releases`, {
    method: 'POST',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ build, note: payload.title ?? null }),
  });
  if (!res.ok) return json({ error: 'supabase_error', status: res.status }, 502);
  return json({ ok: true, build });
};
