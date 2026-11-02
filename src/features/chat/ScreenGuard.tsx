import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { Button, Txt } from '../../ui';
import { tr } from '../../i18n';

const mascot = require('../../../assets/art/mascot.webp');

/**
 * Incognito rooms: best-effort screenshot deterrent.
 * - Native app: the OS blocks captures (Android) and reports screenshots (iOS), via expo-screen-capture.
 * - Web/PWA: browsers expose no screenshot event, so we catch the keyboard shortcuts, hide the chat while the
 *   app is in the background (app switcher / screen recorder overlays) and hide it from printing.
 */
export function ScreenGuard({ children }: { children: React.ReactNode }) {
  const [caught, setCaught] = useState(false);
  const [away, setAway] = useState(false);
  const trip = useCallback(() => { setCaught(true); try { (navigator as Navigator).clipboard?.writeText?.(''); } catch { /* ignore */ } }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let off: (() => void) | undefined;
    let cancelled = false;
    import('expo-screen-capture').then((m) => {
      if (cancelled) return;
      m.preventScreenCaptureAsync('incognito').catch(() => {});
      const sub = m.addScreenshotListener(trip);
      off = () => { sub.remove(); m.allowScreenCaptureAsync('incognito').catch(() => {}); };
    }).catch(() => {});
    return () => { cancelled = true; off?.(); };
  }, [trip]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = '@media' + String.fromCharCode(32) + 'print' + '{body>*{display:none!important}}';
    document.head.appendChild(style);
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const shot = /^Print/.test(e.code) || (e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(k)) || (e.ctrlKey && e.shiftKey && k === 's') || ((e.metaKey || e.ctrlKey) && k === 'p');
      if (shot) { e.preventDefault(); trip(); }
    };
    const vis = () => setAway(document.visibilityState === 'hidden');
    const blur = () => setAway(true);
    const focus = () => setAway(document.visibilityState === 'hidden');
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    return () => {
      style.remove();
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
    };
  }, [trip]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {away && !caught && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#000', zIndex: 4000 } as object} />}
      {caught && (
        <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, zIndex: 5000, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 } as object}>
          <Image source={mascot} style={{ width: 180, height: 180 }} resizeMode="contain" />
          <Txt v="h1" style={{ color: '#fff', textAlign: 'center' }}>{tr('Nice try 😏')}</Txt>
          <Txt v="body" style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', maxWidth: 320 }}>{tr('Esto es incógnito. Aquí no se guardan capturas: lo que se dice aquí, se queda aquí.')}</Txt>
          <Button title={tr('Volver al chat')} onPress={() => setCaught(false)} />
        </View>
      )}
    </View>
  );
}
