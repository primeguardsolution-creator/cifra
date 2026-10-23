import { Platform } from 'react-native';
import { supabase } from './supabase';

export type LinkPreview = { url: string; title: string | null; description: string | null; image: string | null; site: string | null };

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+\.[a-z]{2,}[^\s<>"']*/i;

/** First web link in a text (with a leading "www." completed to https), or null. Trailing punctuation is not part of the link. */
export function firstUrl(text?: string | null): string | null {
  const m = text ? URL_RE.exec(text) : null;
  if (!m) return null;
  const raw = m[0].replace(/[.,;:!?)\]]+$/, '');
  return /^https?:/i.test(raw) ? raw : `https://${raw}`;
}

const cache = new Map<string, Promise<LinkPreview | null>>();

/** Title, description and image of a page (through our own function, which refuses private networks). Null when there is nothing to show. */
export function fetchPreview(url: string): Promise<LinkPreview | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return null;
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { headers: { authorization: `Bearer ${token}` } });
      return res.ok ? ((await res.json()) as LinkPreview) : null;
    })().catch(() => null);
    cache.set(url, p);
  }
  return p;
}

export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
