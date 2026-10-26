import { Platform } from 'react-native';
import { getLocale } from '../i18n';
import { rpc } from './api';
import { supabase } from './supabase';

export type RecoveryStatus = { email_masked: string | null; email_verified: boolean; has_code: boolean; code_created_at: string | null; pending_email: string | null };

/** Calls /api/recovery. Signed-in actions send the session token; the open ones (forgot password) do not. */
async function call<T>(action: string, body: Record<string, unknown> = {}, signedIn = false): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signedIn) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('unauthorized');
    headers.authorization = `Bearer ${data.session.access_token}`;
  }
  const base = Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_APP_URL ?? 'https://cifra-mensajeria.netlify.app');
  const res = await fetch(`${base}/api/recovery`, { method: 'POST', headers, body: JSON.stringify({ action, locale: getLocale(), ...body }) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? 'failed');
  return json;
}

export const recoveryStatus = async () => { const rows = await rpc<RecoveryStatus[]>('my_recovery_status'); return rows?.[0] ?? null; };
export const startEmail = (email: string) => call<{ ok: true }>('email_start', { email }, true);
export const confirmEmail = (code: string) => call<{ ok: true }>('email_confirm', { code }, true);
export const makeRecoveryCode = () => call<{ ok: true; code: string }>('make_code', {}, true);
export const startReset = (phone: string) => call<{ ok: true }>('reset_start', { phone });
export const finishReset = (phone: string, method: 'email' | 'code', secret: string, password: string) => call<{ ok: true }>('reset_finish', { phone, method, secret, password });
