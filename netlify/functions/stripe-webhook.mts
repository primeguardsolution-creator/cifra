// Stripe -> CIFRA. Keeps public.business_billing in sync with the subscription. The signature is verified with the signing secret,
// so only Stripe can change a business's plan. Point the Stripe webhook at https://<your-site>/api/stripe-webhook and send:
// checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function validSignature(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts.t; const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`)));
  return sigs.some((s) => s.length === expected.length && [...s].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

type Sub = { id: string; customer: string; status: string; trial_end: number | null; current_period_end?: number; items?: { data?: { current_period_end?: number }[] }; cancel_at_period_end: boolean; metadata?: { business_id?: string } };

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const env = (k: string) => Netlify.env.get(k) ?? '';
  const [url, service, secret] = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_WEBHOOK_SECRET'].map(env);
  if (!url || !service || !secret) return json({ error: 'not_configured' }, 503);
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get('stripe-signature') ?? '', secret))) return json({ error: 'bad_signature' }, 400);

  const event = JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };
  const db = (path: string, init: RequestInit = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

  const apply = async (sub: Sub) => {
    let business = sub.metadata?.business_id;
    if (!business) {
      const found = (await db(`business_billing?stripe_customer_id=eq.${encodeURIComponent(sub.customer)}&select=business_id`).then((r) => r.json()).catch(() => [])) as { business_id: string }[];
      business = found[0]?.business_id;
    }
    if (!business) { console.error('stripe webhook: subscription without business', sub.id); return; }
    const period = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    const res = await db('business_billing?on_conflict=business_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({
      business_id: business, stripe_customer_id: sub.customer, stripe_subscription_id: sub.id, status: sub.status, trial_end: iso(sub.trial_end), current_period_end: iso(period), cancel_at_period_end: sub.cancel_at_period_end, updated_at: new Date().toISOString(),
    }) });
    if (!res.ok) throw new Error(`db ${res.status}`);
  };

  try {
    const obj = event.data.object;
    if (event.type.startsWith('customer.subscription.')) await apply(obj as unknown as Sub);
    else if (event.type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
      const sub = await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, { headers: { authorization: `Bearer ${env('STRIPE_SECRET_KEY')}` } }).then((r) => r.json()) as Sub;
      if (!sub.metadata?.business_id && obj.client_reference_id) sub.metadata = { business_id: String(obj.client_reference_id) };
      await apply(sub);
    }
  } catch (e) {
    console.error('stripe webhook failed', (e as Error).message);
    return json({ error: 'failed' }, 500); // Stripe retries
  }
  return json({ received: true });
};
