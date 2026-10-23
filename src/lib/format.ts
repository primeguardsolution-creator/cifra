import { loc, t, tr } from '../i18n';
export function uuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  const b = new Uint8Array(16);
  if (g.crypto?.getRandomValues) g.crypto.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const hm = (d: Date) => d.toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });

export function listTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso); const now = new Date();
  if (sameDay(d, now)) return hm(d);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return tr('Ayer');
  if (now.getTime() - d.getTime() < 6 * 864e5) return d.toLocaleDateString(loc(), { weekday: 'short' }).replace('.', '');
  return d.toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: '2-digit' });
}
export const messageTime = (iso: string) => hm(new Date(iso));

export function dayLabel(iso: string) {
  const d = new Date(iso); const now = new Date();
  if (sameDay(d, now)) return tr('Hoy');
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return tr('Ayer');
  return d.toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' });
}

export function relative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return tr('ahora');
  if (mins < 60) return t('hace {n} min', { n: mins });
  const h = Math.round(mins / 60);
  return h < 24 ? t('hace {n} h', { n: h }) : listTime(iso);
}

export function bytes(n?: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function money(minor?: number | null, currency?: string | null) {
  if (minor == null) return '';
  try { return new Intl.NumberFormat(loc(), { style: 'currency', currency: currency || 'EUR' }).format(minor / 100); } catch { return `${(minor / 100).toFixed(2)} ${currency ?? ''}`; }
}

export const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
