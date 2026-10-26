// Account recovery: verify an e-mail with a 6-digit code, issue a one-time recovery code, and reset a forgotten password with either.
// POST /api/recovery {action, ...}. Signed-in actions (Bearer token): email_start, email_confirm, make_code. Open actions: reset_start, reset_finish.
// All secrets are hashed before they reach the database (public.recovery_* functions do the attempt limits); mail goes out through Brevo's HTTPS API.
// Env (Netlify, Functions scope): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, MAIL_FROM_EMAIL, optional MAIL_FROM_NAME, RECOVERY_PEPPER.
import { createHash, randomInt } from 'node:crypto';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
type Locale = 'es' | 'en' | 'de';
const asLocale = (l: unknown): Locale => (l === 'en' || l === 'de' ? l : 'es');

export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const hashSecret = (pepper: string, userId: string, kind: string, secret: string) => createHash('sha256').update(`${pepper}:${userId}:${kind}:${secret}`).digest('hex');
export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export function newRecoveryCode() { let s = ''; for (let i = 0; i < 12; i++) s += ALPHABET[randomInt(0, ALPHABET.length)]; return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`; }

const MAIL: Record<Locale, { verify: (c: string) => [string, string]; reset: (c: string) => [string, string] }> = {
  es: { verify: (c) => [`${c} es tu código de CIFRA`, `Tu código para confirmar este correo en CIFRA es ${c}. Caduca en 10 minutos. Si no lo pediste, ignora este mensaje.`], reset: (c) => [`${c} es tu código para recuperar tu cuenta de CIFRA`, `Tu código para recuperar el acceso a CIFRA es ${c}. Caduca en 10 minutos. Si no lo pediste tú, ignora este mensaje: tu contraseña no ha cambiado.`] },
  en: { verify: (c) => [`${c} is your CIFRA code`, `Your code to confirm this e-mail in CIFRA is ${c}. It expires in 10 minutes. If you did not ask for it, ignore this message.`], reset: (c) => [`${c} is your code to recover your CIFRA account`, `Your code to get back into CIFRA is ${c}. It expires in 10 minutes. If it was not you, ignore this message: your password has not changed.`] },
  de: { verify: (c) => [`${c} ist dein CIFRA-Code`, `Dein Code zur Bestätigung dieser E-Mail in CIFRA lautet ${c}. Er ist 10 Minuten gültig. Wenn du ihn nicht angefordert hast, ignoriere diese Nachricht.`], reset: (c) => [`${c} ist dein Code zur Wiederherstellung deines CIFRA-Kontos`, `Dein Code, um wieder in CIFRA hineinzukommen, lautet ${c}. Er ist 10 Minuten gültig. Wenn du es nicht warst, ignoriere diese Nachricht: Dein Passwort wurde nicht geändert.`] },
};

// Light per-instance brake against floods from one address (the database enforces the real per-account limits).
const hits = new Map<string, { n: number; at: number }>();
function tooMany(ip: string, max = 30, windowMs = 10 * 60_000) {
  const now = Date.now(); const h = hits.get(ip);
  if (!h || now - h.at > windowMs) { hits.set(ip, { n: 1, at: now }); if (hits.size > 2000) hits.clear(); return false; }
  h.n++; return h.n > max;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const env = (k: string) => Netlify.env.get(k) ?? '';
  const [url, anon, service, brevo, from] = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'BREVO_API_KEY', 'MAIL_FROM_EMAIL'].map(env);
  if (!url || !anon || !service) return json({ error: 'not_configured' }, 503);
  const pepper = env('RECOVERY_PEPPER');
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  if (tooMany(ip)) return json({ error: 'rate_limited' }, 429);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? '');
  const locale = asLocale(body?.locale);
  const rpc = (fn: string, args: unknown) => fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const rpcJson = async <T,>(fn: string, args: unknown): Promise<{ ok: boolean; data: T | null; text: string }> => { const r = await rpc(fn, args).catch(() => null); const text = r ? await r.text().catch(() => '') : ''; return { ok: !!r && r.ok, data: r && r.ok && text ? (JSON.parse(text) as T) : null, text }; };
  const send = async (to: string, purpose: 'verify' | 'reset', code: string) => {
    if (!brevo || !from) return false;
    const [subject, text] = MAIL[locale][purpose](code);
    const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': brevo, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { name: env('MAIL_FROM_NAME') || 'CIFRA', email: from }, to: [{ email: to }], subject, textContent: text, htmlContent: `<div style="font-family:Arial,sans-serif;font-size:16px;color:#111"><p>${text.replace(code, `<b style="font-size:24px;letter-spacing:4px">${code}</b>`)}</p><p style="color:#888;font-size:12px">CIFRA</p></div>` }) }).catch(() => null);
    return !!r && r.ok;
  };
  const failed = (text: string) => (/rate_limited/.test(text) ? json({ error: 'rate_limited' }, 429) : json({ error: 'failed' }, 400));

  // ── open actions: forgotten password ──
  if (action === 'reset_start' || action === 'reset_finish') {
    const phone = String(body?.phone ?? '');
    if (!/^\+\d{6,15}$/.test(phone)) return json({ error: 'invalid_or_expired' }, 400);
    const who = await rpcJson<{ user_id: string; has_email: boolean; email: string | null; has_code: boolean }[]>('recovery_lookup', { p_phone: phone });
    const row = who.data?.[0];
    if (action === 'reset_start') {
      // always the same answer, so nobody can use this to find out which numbers have an account
      if (row?.has_email && row.email) {
        const otp = newOtp();
        const begin = await rpcJson('recovery_begin_email', { p_user: row.user_id, p_email: row.email, p_otp_hash: hashSecret(pepper, row.user_id, 'reset', otp), p_purpose: 'reset', p_ttl_minutes: 10 });
        if (begin.ok) await send(row.email, 'reset', otp);
      }
      return json({ ok: true });
    }
    const method = body?.method === 'code' ? 'code' : 'email';
    const secret = String(body?.secret ?? ''); const password = String(body?.password ?? '');
    if (password.length < 8 || password.length > 72) return json({ error: 'weak_password' }, 400);
    if (!row) return json({ error: 'invalid_or_expired' }, 400);
    const ok = method === 'code'
      ? (await rpcJson<boolean>('recovery_check_code', { p_user: row.user_id, p_code_hash: hashSecret(pepper, row.user_id, 'code', normalizeCode(secret)) })).data === true
      : (await rpcJson<boolean>('recovery_check_otp', { p_user: row.user_id, p_otp_hash: hashSecret(pepper, row.user_id, 'reset', secret.replace(/\D/g, '')), p_purpose: 'reset' })).data === true;
    if (!ok) return json({ error: 'invalid_or_expired' }, 400);
    const upd = await fetch(`${url}/auth/v1/admin/users/${row.user_id}`, { method: 'PUT', headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' }, body: JSON.stringify({ password }) }).catch(() => null);
    if (!upd || !upd.ok) return json({ error: 'update_failed' }, 502);
    return json({ ok: true, usedCode: method === 'code' });
  }

  // ── signed-in actions ──
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return json({ error: 'unauthorized' }, 401);
  const me = await fetch(`${url}/auth/v1/user`, { headers: { authorization, apikey: anon } }).catch(() => null);
  if (!me || !me.ok) return json({ error: 'unauthorized' }, 401);
  const userId = String(((await me.json().catch(() => null)) as { id?: string } | null)?.id ?? '');
  if (!userId) return json({ error: 'unauthorized' }, 401);

  if (action === 'email_start') {
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'invalid_email' }, 400);
    const otp = newOtp();
    const begin = await rpcJson('recovery_begin_email', { p_user: userId, p_email: email, p_otp_hash: hashSecret(pepper, userId, 'verify', otp), p_purpose: 'verify', p_ttl_minutes: 10 });
    if (!begin.ok) return failed(begin.text);
    if (!(await send(email, 'verify', otp))) return json({ error: 'mail_failed' }, 502);
    return json({ ok: true });
  }
  if (action === 'email_confirm') {
    const code = String(body?.code ?? '').replace(/\D/g, '');
    if (code.length !== 6) return json({ error: 'invalid_or_expired' }, 400);
    const r = await rpcJson<boolean>('recovery_check_otp', { p_user: userId, p_otp_hash: hashSecret(pepper, userId, 'verify', code), p_purpose: 'verify' });
    return r.data === true ? json({ ok: true }) : json({ error: 'invalid_or_expired' }, 400);
  }
  if (action === 'make_code') {
    const code = newRecoveryCode();
    const r = await rpcJson('recovery_set_code', { p_user: userId, p_code_hash: hashSecret(pepper, userId, 'code', normalizeCode(code)) });
    return r.ok ? json({ ok: true, code }) : json({ error: 'failed' }, 500);
  }
  return json({ error: 'bad_request' }, 400);
};
