// Link preview for posts and statuses: reads the Open Graph tags of a public web page (title, description, image) so the app can show a card.
// Only signed-in users may call it, it only talks to public http(s) hosts (private networks are refused, also after redirects), and it reads at most 400 KB.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
const cache = new Map<string, { at: number; data: Preview | null }>();
const TTL = 60 * 60 * 1000;
type Preview = { url: string; title: string | null; description: string | null; image: string | null; site: string | null };

export function privateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    if (x.startsWith('::ffff:')) return privateAddress(x.slice(7));
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff');
  }
  return true;
}

async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null;
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => privateAddress(a.address))) return null;
  } catch { return null; }
  return u;
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff))).replace(/\s+/g, ' ').trim();

export function parseMeta(html: string, base: URL): Preview {
  const metas: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const val = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    if (key && val && metas[key] === undefined) metas[key] = decode(val[1] ?? val[2] ?? '');
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  let image: string | null = metas['og:image'] || metas['og:image:url'] || metas['twitter:image'] || null;
  if (image) { try { const abs = new URL(image, base); image = abs.protocol === 'https:' || abs.protocol === 'http:' ? abs.toString() : null; } catch { image = null; } }
  const cut = (s: string | undefined | null, n: number) => (s ? s.slice(0, n) : null) || null;
  return { url: base.toString(), title: cut(metas['og:title'] || metas['twitter:title'] || (titleTag ? decode(titleTag) : ''), 160), description: cut(metas['og:description'] || metas['twitter:description'] || metas['description'], 280), image, site: cut(metas['og:site_name'], 80) ?? base.hostname.replace(/^www\./, '') };
}

async function readHtml(start: URL): Promise<{ html: string; url: URL } | null> {
  let u: URL | null = start;
  for (let hop = 0; hop < 4 && u; hop++) {
    const res = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(4500), headers: { 'user-agent': 'Mozilla/5.0 (compatible; CIFRA-LinkPreview/1.0)', accept: 'text/html,application/xhtml+xml', 'accept-language': 'en' } }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400) { const next = res.headers.get('location'); u = next ? await safeUrl(new URL(next, u).toString()) : null; continue; }
    if (!res.ok || !/text\/html|application\/xhtml/i.test(res.headers.get('content-type') ?? '') || !res.body) return null;
    const reader = res.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
    while (total < 400_000) { const { done, value } = await reader.read(); if (done || !value) break; chunks.push(value); total += value.length; }
    reader.cancel().catch(() => {});
    return { html: new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks)), url: u };
  }
  return null;
}

export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const supabaseUrl = Netlify.env.get('SUPABASE_URL'); const key = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY');
  const authorization = req.headers.get('authorization') ?? '';
  if (!supabaseUrl || !key) return json({ error: 'not_configured' }, 503);
  if (!authorization.toLowerCase().startsWith('bearer ')) return json({ error: 'unauthorized' }, 401);
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { authorization, apikey: key } }).catch(() => null);
  if (!who || !who.ok) return json({ error: 'unauthorized' }, 401);

  const raw = new URL(req.url).searchParams.get('url') ?? '';
  if (raw.length > 2000) return json({ error: 'bad_request' }, 400);
  const hit = cache.get(raw);
  if (hit && Date.now() - hit.at < TTL) return hit.data ? json(hit.data, 200, { 'cache-control': 'private, max-age=3600' }) : json({ error: 'no_preview' }, 404);
  const target = await safeUrl(raw);
  if (!target) return json({ error: 'bad_url' }, 400);
  const page = await readHtml(target);
  const data = page ? parseMeta(page.html, page.url) : null;
  const usable = data && (data.title || data.image || data.description) ? data : null;
  if (cache.size > 300) cache.clear();
  cache.set(raw, { at: Date.now(), data: usable });
  return usable ? json(usable, 200, { 'cache-control': 'private, max-age=3600' }) : json({ error: 'no_preview' }, 404);
};
