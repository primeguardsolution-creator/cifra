import { Platform } from 'react-native';

/** The app icon comes in five "eras" (same design, different colours). The home-screen icon of a web app is read when it is added, so the
 *  choice travels as `?icon=<key>`: the page swaps its icon links before the person adds CIFRA to the home screen (see app/+html.tsx). */
export type IconKey = 'moderno' | 'clasico' | 'retro70' | 'neon80' | 'y2k';
export const ICONS: { key: IconKey; label: string; era: string }[] = [
  { key: 'moderno', label: 'Moderno', era: 'Violeta sobre noche · hoy' },
  { key: 'clasico', label: 'Clásico B/N', era: 'Blanco y negro antiguo · años 30' },
  { key: 'retro70', label: 'Retro 70', era: 'Naranja y mostaza · años 70' },
  { key: 'neon80', label: 'Neón 80', era: 'Rosa y cian eléctricos · años 80' },
  { key: 'y2k', label: 'Y2K', era: 'Azul brillante y lima · año 2000' },
];
const STORE = 'cifra.icon';
const isKey = (k: unknown): k is IconKey => ICONS.some((i) => i.key === k);

export function currentIcon(): IconKey {
  try { const k = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE) : null; return isKey(k) ? k : 'moderno'; } catch { return 'moderno'; }
}

export const iconUrl = (key: IconKey, file = 'preview.png') => `/icons/${key}/${file}`;
/** Link to open in Safari (or Chrome) and add to the home screen with this icon. */
export const installLink = (key: IconKey) => `${Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://cifra-mensajeria.netlify.app'}/?icon=${key}`;

/** Switches the tab icon, the apple-touch-icon and the web manifest of the open page to the chosen variant. */
export function applyIcon(key: IconKey) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  try { localStorage.setItem(STORE, key); } catch { /* the choice still applies to this visit */ }
  const set = (sel: string, href: string) => { const el = document.querySelector<HTMLLinkElement>(sel); if (el) el.href = href; };
  set('link[rel="apple-touch-icon"]', iconUrl(key, 'apple-touch-icon.png'));
  set('link[rel="icon"]', iconUrl(key, 'favicon-32.png'));
  const origin = window.location.origin;
  const manifest = { name: 'CIFRA', short_name: 'CIFRA', start_url: `${origin}/`, scope: `${origin}/`, display: 'standalone', orientation: 'portrait', background_color: '#000000', theme_color: '#5A39E8', lang: 'es',
    icons: [192, 512].flatMap((s) => [{ src: `${origin}${iconUrl(key, `icon-${s}.png`)}`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' }, { src: `${origin}${iconUrl(key, `icon-${s}-maskable.png`)}`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'maskable' }]) };
  set('link[rel="manifest"]', URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })));
}
