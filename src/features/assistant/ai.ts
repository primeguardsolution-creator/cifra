import { supabase } from '../../lib/supabase';

export type AiTurn = { role: 'user' | 'assistant'; content: string };

/** 'unknown' until the first try; 'off' when the server has no Claude key (or the call keeps failing) so we stop asking this session. */
let availability: 'unknown' | 'on' | 'off' = 'unknown';
let failures = 0;

export const aiMaybeAvailable = () => availability !== 'off';

/** Asks the optional Claude-powered function. Returns null whenever it is not configured or fails: the caller falls back to the local answer. */
export async function askClaude(history: AiTurn[], locale: 'es' | 'en' | 'de' = 'es'): Promise<string | null> {
  if (availability === 'off') return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    const res = await fetch('/api/assistant', { method: 'POST', signal: ctl.signal, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-10), locale }) }).finally(() => clearTimeout(timer));
    if (res.status === 503 || res.status === 404 || !(res.headers.get('content-type') ?? '').includes('json')) { availability = 'off'; return null; }
    if (res.status === 429) return null;
    if (!res.ok) { if (++failures >= 3) availability = 'off'; return null; }
    const body = (await res.json()) as { text?: string };
    if (!body.text) return null;
    availability = 'on'; failures = 0;
    return body.text;
  } catch {
    if (++failures >= 3) availability = 'off';
    return null;
  }
}
