import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Pressy, Txt } from '../ui';

const BUILD = process.env.EXPO_PUBLIC_BUILD_ID ?? '';
const EVERY = 10 * 60_000;

/**
 * PWA: "there is a new version" strip. The build writes `version.json` next to the bundle with the same build id that
 * is baked into the app; when they differ (a newer deploy), a tap reloads. Native builds show nothing.
 */
export function UpdateBanner() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !BUILD || typeof fetch === 'undefined') return;
    let live = true;
    const check = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as { build?: string };
        if (live && j.build && j.build !== BUILD) setFresh(j.build);
      } catch { /* offline: try later */ }
    };
    check();
    const timer = setInterval(check, EVERY);
    const vis = () => { if (typeof document !== 'undefined' && !document.hidden) check(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', vis);
    return () => { live = false; clearInterval(timer); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', vis); };
  }, []);
  if (!fresh) return null;
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: '#1FA67A' }}>
      <Pressy onPress={() => { if (typeof window !== 'undefined') window.location.reload(); }} accessibilityRole="button" accessibilityLabel="Actualizar CIFRA" scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 9 }}>
        <Icon name="sparkles" size={16} color="#fff" />
        <Txt v="smallStrong" style={{ color: '#fff', flex: 1 }}>Hay una versión nueva de CIFRA</Txt>
        <View style={{ paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center' }}><Txt v="caption" style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Actualizar</Txt></View>
      </Pressy>
      <View style={{ height: 0, backgroundColor: c.border }} />
    </View>
  );
}
