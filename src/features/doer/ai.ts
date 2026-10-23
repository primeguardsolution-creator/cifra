import { supabase } from '../../lib/supabase';
import { DoerAction, DoerReply } from './actions';
import { getLocale } from '../../i18n';

let availability: 'unknown' | 'on' | 'off' = 'unknown';
export const doerAiMaybe = () => availability !== 'off';

/** Asks the Claude-powered Doer function to turn a free-form request into actions. Null = unavailable (caller falls back to examples). */
export async function askDoer(history: { role: 'user' | 'assistant'; content: string }[], ctx: { businessName: string; customers: string[] }): Promise<DoerReply | null> {
  if (availability === 'off') return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const now = new Date();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 28000);
    const res = await fetch('/api/doer', {
      method: 'POST', signal: ctl.signal, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-8), context: { locale: getLocale(), now: now.toString(), nowIso: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, businessName: ctx.businessName, customers: ctx.customers.slice(0, 80) } }),
    }).finally(() => clearTimeout(timer));
    if (res.status === 503 || res.status === 404 || !(res.headers.get('content-type') ?? '').includes('json')) { availability = 'off'; return null; }
    if (!res.ok) return null;
    const body = (await res.json()) as { reply?: string; actions?: DoerAction[] };
    availability = 'on';
    return { reply: body.reply ?? '', actions: Array.isArray(body.actions) ? body.actions : [] };
  } catch { return null; }
}
