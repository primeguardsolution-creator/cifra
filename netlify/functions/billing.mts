// Stripe subscription for a business. Signed-in owners/admins only (their Supabase session is verified and the business role is checked in the database).
//   POST { action: 'checkout', business }  -> { url }  Stripe Checkout (monthly plan, optional free trial)
//   POST { action: 'portal', business }    -> { url }  Stripe customer portal (card, invoices, cancel)
// The plan state itself is written by /api/stripe-webhook. Secrets live in Netlify environment variables, never in the app.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Stripe wants form encoding with bracketed keys for nesting. */
function form(obj: Record<string, unknown>, prefix = '', out: [string, string][] = []): [string, string][] {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v as Record<string, unknown>, key, out); else out.push([key, String(v)]);
  }
  return out;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const env = (k: string) => Netlify.env.get(k) ?? '';
  const [url, anon, service, stripeKey, priceId] = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID'].map(env);
  if (!url || !anon || !service) return json({ error: 'not_configured' }, 503);
  if (!stripeKey || !priceId) return json({ error: 'billing_not_configured' }, 503);

  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return json({ error: 'unauthorized' }, 401);
  const who = await fetch(`${url}/auth/v1/user`, { headers: { authorization, apikey: anon } }).catch(() => null);
  if (!who || !who.ok) return json({ error: 'unauthorized' }, 401);
  const user = (await who.json().catch(() => null)) as { id?: string; email?: string } | null;

  const body = (await req.json().catch(() => null)) as { action?: string; business?: string } | null;
  const business = String(body?.business ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(business)) return json({ error: 'invalid_business' }, 400);

  // Only a manager of this business (owner / admin): checked with the caller's own session.
  const mgr = await fetch(`${url}/rest/v1/rpc/is_business_manager`, { method: 'POST', headers: { authorization, apikey: anon, 'content-type': 'application/json' }, body: JSON.stringify({ target_business_id: business }) }).catch(() => null);
  if (!mgr || !mgr.ok || (await mgr.json().catch(() => false)) !== true) return json({ error: 'forbidden' }, 403);

  const db = (path: string, init: RequestInit = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const stripe = async (path: string, params: Record<string, unknown>) => {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'POST', headers: { authorization: `Bearer ${stripeKey}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form(params)) }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } }) : null;
    if (!res || !res.ok) { console.error('stripe', path, res?.status, data?.error?.message); return null; }
    return data;
  };

  const rows = (await db(`business_billing?business_id=eq.${business}&select=stripe_customer_id,status`).then((r) => r.json()).catch(() => [])) as { stripe_customer_id: string | null; status: string }[];
  let customer = rows[0]?.stripe_customer_id ?? null;
  const origin = (env('APP_URL') || req.headers.get('origin') || new URL(req.url).origin).replace(/\/$/, '');
  const back = `${origin}/business`;

  if (body?.action === 'checkout') {
    if (rows[0] && ['active', 'trialing', 'past_due'].includes(rows[0].status)) return json({ error: 'already_subscribed' }, 409);
    if (!customer) {
      const created = await stripe('customers', { email: user?.email && !user.email.endsWith('.example.com') ? user.email : undefined, metadata: { business_id: business, user_id: user?.id } });
      if (!created) return json({ error: 'stripe_failed' }, 502);
      customer = String(created.id);
      await db('business_billing?on_conflict=business_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ business_id: business, stripe_customer_id: customer }) });
    }
    const trial = Number(env('STRIPE_TRIAL_DAYS') || 0);
    const session = await stripe('checkout/sessions', {
      mode: 'subscription', customer, client_reference_id: business,
      line_items: { 0: { price: priceId, quantity: 1 } },
      allow_promotion_codes: 'true', billing_address_collection: 'auto',
      subscription_data: { metadata: { business_id: business }, trial_period_days: trial > 0 ? trial : undefined },
      success_url: `${back}?billing=ok`, cancel_url: `${back}?billing=cancel`,
    });
    return session?.url ? json({ url: session.url }) : json({ error: 'stripe_failed' }, 502);
  }

  if (body?.action === 'portal') {
    if (!customer) return json({ error: 'no_subscription' }, 404);
    const session = await stripe('billing_portal/sessions', { customer, return_url: back });
    return session?.url ? json({ url: session.url }) : json({ error: 'stripe_failed' }, 502);
  }

  return json({ error: 'unknown_action' }, 400);
};
