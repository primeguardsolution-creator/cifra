import { Linking, Platform } from 'react-native';
import { unwrap } from './api';
import { supabase } from './supabase';

export type BillingStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused';
export type Billing = { business_id: string; status: BillingStatus; trial_end: string | null; current_period_end: string | null; cancel_at_period_end: boolean };

/** The plan of a business (owners / admins only; anyone else gets null). */
export async function getBilling(businessId: string): Promise<Billing | null> {
  const rows = unwrap(await supabase.from('business_billing').select('business_id, status, trial_end, current_period_end, cancel_at_period_end').eq('business_id', businessId).limit(1)) as Billing[];
  return rows[0] ?? null;
}

export const isPaid = (b: Billing | null) => !!b && (b.status === 'active' || b.status === 'trialing' || b.status === 'past_due');

async function call(action: 'checkout' | 'portal', business: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('unauthorized');
  const base = Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_APP_URL ?? 'https://cifra-mensajeria.netlify.app');
  const res = await fetch(`${base}/api/billing`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ action, business }) });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? 'failed');
  return json.url;
}

/** Sends the person to Stripe (Checkout to subscribe, portal to manage). */
export async function goToStripe(action: 'checkout' | 'portal', business: string) {
  const url = await call(action, business);
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.href = url; else await Linking.openURL(url);
}
