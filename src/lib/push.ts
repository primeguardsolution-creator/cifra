import { Platform } from 'react-native';
import { rpc } from './api';

/** Public VAPID key (safe in the client); the matching private key only lives in the Netlify function. */
const VAPID = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type PushStatus = 'unsupported' | 'needs-install' | 'not-configured' | 'denied' | 'off' | 'on';

const isWeb = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof window !== 'undefined';
export const isIOS = () => isWeb() && /iPad|iPhone|iPod/.test(navigator.userAgent) || (isWeb() && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => isWeb() && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

const toKey = (b64: string) => { const pad = '='.repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (ch) => ch.charCodeAt(0)); };

async function registration() {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export async function pushStatus(): Promise<PushStatus> {
  if (!isWeb() || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (isIOS() && !isStandalone()) return 'needs-install'; // iPhone only allows push for apps added to the home screen
  if (!VAPID) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const sub = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

async function save(sub: PushSubscription) {
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) throw new Error('Suscripción no válida.');
  await rpc<void>('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent.slice(0, 280) });
}

/** Must run from a tap (iOS only shows the permission prompt after a user gesture). */
export async function enablePush(): Promise<void> {
  const st = await pushStatus();
  if (st === 'needs-install') throw new Error('needs_install');
  if (st === 'unsupported' || st === 'not-configured') throw new Error(st);
  if (st === 'denied') throw new Error('denied');
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID) }));
  await save(sub);
}

export async function disablePush(): Promise<void> {
  if (!isWeb() || !('serviceWorker' in navigator)) return;
  const sub = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription();
  if (!sub) return;
  await rpc<void>('delete_push_subscription', { p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** On every start: if notifications were allowed, make sure this device is registered for the signed-in account (the phone may have switched accounts). */
export async function syncPush(): Promise<void> {
  try {
    if ((await pushStatus()) !== 'on') return;
    const sub = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription();
    if (sub) await save(sub);
  } catch { /* push is optional */ }
}

/** Taps on a notification arrive from the service worker as a message; `go` navigates inside the app. */
export function listenForNotificationTaps(go: (url: string) => void): () => void {
  if (!isWeb() || !('serviceWorker' in navigator)) return () => {};
  const on = (e: MessageEvent) => { if (e.data?.type === 'cifra-open' && typeof e.data.url === 'string') go(e.data.url); };
  navigator.serviceWorker.addEventListener('message', on);
  return () => navigator.serviceWorker.removeEventListener('message', on);
}

export function setAppBadge(n: number) {
  try {
    const nav = navigator as unknown as { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (n > 0) nav.setAppBadge?.(n)?.catch?.(() => {}); else nav.clearAppBadge?.()?.catch?.(() => {});
  } catch { /* badges are optional */ }
}
