// Delivers the outgoing webhooks of the businesses. Runs every minute (Netlify scheduled function) and retries failures with backoff.
import { sweep } from '../lib/integrations.ts';

export default async () => {
  const url = Netlify.env.get('SUPABASE_URL'); const key = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('not_configured', { status: 503 });
  const r = await sweep({ url, key }).catch((e) => ({ tried: 0, ok: 0, error: (e as Error).message }));
  return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } });
};

export const config = { schedule: '* * * * *' };
