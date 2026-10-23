// Returns STUN/TURN servers for WebRTC calls. Only signed-in CIFRA users can call it (their Supabase session is verified),
// so the Twilio relay cannot be abused anonymously. The Twilio credentials live in Netlify environment variables, never in the app.
const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default async (req: Request) => {
  const supabaseUrl = Netlify.env.get('SUPABASE_URL');
  const supabaseKey = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY');
  const authorization = req.headers.get('authorization') ?? '';
  if (!supabaseUrl || !supabaseKey) return json({ error: 'server_not_configured' }, 503);
  if (!authorization.toLowerCase().startsWith('bearer ')) return json({ error: 'unauthorized' }, 401);

  const who = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { authorization, apikey: supabaseKey } }).catch(() => null);
  if (!who || !who.ok) return json({ error: 'unauthorized', upstream: who?.status ?? 'unreachable' }, 401);

  const accountSid = Netlify.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Netlify.env.get('TWILIO_AUTH_TOKEN');
  const keySid = Netlify.env.get('TWILIO_API_KEY_SID');
  const keySecret = Netlify.env.get('TWILIO_API_KEY_SECRET');
  const user = keySid && keySecret ? keySid : accountSid;
  const pass = keySid && keySecret ? keySecret : authToken;
  if (!accountSid || !user || !pass) return json({ iceServers: STUN, relay: false });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`, {
      method: 'POST',
      headers: { authorization: `Basic ${btoa(`${user}:${pass}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'Ttl=3600',
    });
    if (!res.ok) return json({ iceServers: STUN, relay: false, note: `twilio_${res.status}` });
    const data = (await res.json()) as { ice_servers?: { url?: string; urls?: string | string[]; username?: string; credential?: string }[] };
    const iceServers = (data.ice_servers ?? []).map((s) => ({ urls: s.urls ?? s.url ?? '', username: s.username, credential: s.credential })).filter((s) => s.urls);
    return json({ iceServers: iceServers.length ? iceServers : STUN, relay: iceServers.length > 0 });
  } catch {
    return json({ iceServers: STUN, relay: false });
  }
};

