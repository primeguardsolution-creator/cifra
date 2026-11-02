import { Platform } from 'react-native';
import { rpc, unwrap } from './api';
import { supabase } from './supabase';

export const WEBHOOK_EVENTS = [
  { key: 'message.received', label: 'Mensaje de un cliente' },
  { key: 'conversation.created', label: 'Conversación nueva' },
  { key: 'customer.created', label: 'Cliente nuevo' },
  { key: 'customer.stage_changed', label: 'Cliente cambia de etapa' },
  { key: 'appointment.created', label: 'Cita nueva' },
  { key: 'appointment.updated', label: 'Cita cambia de estado o de hora' },
] as const;

export type Webhook = { id: string; business_id: string; name: string; url: string; secret: string; events: string[]; active: boolean; last_status: number | null; last_error: string | null; last_at: string | null };
export type Delivery = { id: string; event: string; status: 'pending' | 'delivered' | 'failed'; attempts: number; response_code: number | null; error: string | null; created_at: string };
export type ApiKey = { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

const hookCols = 'id, business_id, name, url, secret, events, active, last_status, last_error, last_at';
export const listWebhooks = async (business: string) => unwrap(await supabase.from('integration_webhooks').select(hookCols).eq('business_id', business).order('created_at')) as Webhook[];
export const createWebhook = async (v: { business_id: string; name: string; url: string; events: string[] }) => unwrap(await supabase.from('integration_webhooks').insert(v).select(hookCols).single()) as Webhook;
export const updateWebhook = async (id: string, patch: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'active'>>) => { unwrap(await supabase.from('integration_webhooks').update(patch).eq('id', id)); };
export const deleteWebhook = async (id: string) => { unwrap(await supabase.from('integration_webhooks').delete().eq('id', id)); };
export const listDeliveries = async (webhook: string) => unwrap(await supabase.from('integration_deliveries').select('id, event, status, attempts, response_code, error, created_at').eq('webhook_id', webhook).order('created_at', { ascending: false }).limit(10)) as Delivery[];

/** Queues a test event and delivers it right away; resolves with what the other side answered. */
export async function testWebhook(id: string): Promise<{ tried: number; ok: number; last?: { code: number; error: string | null } }> {
  await rpc<void>('webhook_test', { p_webhook: id });
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('unauthorized');
  const base = Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_APP_URL ?? 'https://cifra-mensajeria.netlify.app');
  const res = await fetch(`${base}/api/integrations`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ webhook: id }) });
  const json = (await res.json().catch(() => ({}))) as { tried: number; ok: number; last?: { code: number; error: string | null }; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'failed');
  return json;
}

export const listApiKeys = async (business: string) => unwrap(await supabase.from('integration_keys').select('id, name, key_prefix, created_at, last_used_at, revoked_at').eq('business_id', business).is('revoked_at', null).order('created_at')) as ApiKey[];
export const createApiKey = (business: string, name: string) => rpc<string>('create_api_key', { p_business: business, p_name: name });
export const revokeApiKey = (id: string) => rpc<void>('revoke_api_key', { p_id: id });
