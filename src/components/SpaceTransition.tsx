import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from '../lib/motion';
import { palettes, Space } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Txt } from '../ui';
import { t } from '../i18n';

/**
 * Personal ⇄ Business: one frosted-glass sheet crosses the screen diagonally from a corner. While it covers the screen the
 * workspace changes underneath (`onCovered`), then the sheet carries on to the opposite corner and leaves (`onDone`).
 * A single continuous motion with a soft ease: no bounce, no artwork.
 */
export function SpaceTransition({ to, onCovered, onDone }: { to: Space; onCovered: () => void; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const { mode, c } = useTheme();
  const reduced = useReducedMotion();
  const business = to === 'business';
  const p = useSharedValue(0);
  const [cb] = useState(() => ({ covered: onCovered, done: onDone }));
  cb.covered = onCovered; cb.done = onDone;

  useEffect(() => {
    let live = true;
    p.value = withTiming(1, { duration: reduced ? 160 : 820, easing: Easing.bezier(0.5, 0, 0.2, 1) }, (finished) => { if (finished) scheduleOnRN(() => { if (live) cb.done(); }); });
    return () => { live = false; };
  }, [p, cb, reduced]);
  // The swap happens exactly once, the moment the sheet fully covers the screen (half way).
  useAnimatedReaction(() => p.value >= 0.5, (now, before) => { if (now && !before) scheduleOnRN(() => cb.covered()); });

  // Business arrives from the top-right corner and leaves bottom-left; Personal mirrors it.
  const dir = business ? 1 : -1;
  const palette = palettes[to][mode];
  const tint = mode === 'dark' ? 'rgba(12,14,18,0.62)' : 'rgba(255,255,255,0.58)';
  const sheet = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(p.value, [0, 0.5, 1], [dir * width * 1.05, 0, -dir * width * 1.05]) },
      { translateY: interpolate(p.value, [0, 0.5, 1], [-height * 0.55, 0, height * 0.55]) },
    ],
  }));
  const label = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.3, 0.45, 0.58, 0.72], [0, 1, 1, 0], 'clamp'), transform: [{ translateY: interpolate(p.value, [0.3, 0.5], [6, 0], 'clamp') }] }));

  return (
    <View pointerEvents="auto" accessibilityViewIsModal accessibilityLiveRegion="polite" accessibilityLabel={business ? t('Espacio Business') : t('Espacio Personal')}
      style={{ position: 'absolute', inset: 0, zIndex: 2000, overflow: 'hidden' } as object}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' }, sheet]}>
        <BlurView intensity={Platform.OS === 'web' ? 40 : 34} tint={mode === 'dark' ? 'dark' : 'light'} style={{ position: 'absolute', inset: 0, backgroundColor: tint } as object} />
        <LinearGradient colors={[`${c.accent}33`, 'rgba(255,255,255,0)', `${c.accent}1F`]} start={{ x: dir > 0 ? 1 : 0, y: 0 }} end={{ x: dir > 0 ? 0 : 1, y: 1 }} style={{ position: 'absolute', inset: 0 } as object} />
        <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, label]}>
          <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: palette.accent }} />
          <Txt v="h3" style={{ color: c.text }}>{business ? t('Espacio Business') : t('Espacio Personal')}</Txt>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
