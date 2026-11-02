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
 * Personal ⇄ Business: one frosted-glass sheet sweeps across the screen diagonally from a corner. While it covers the screen the
 * workspace changes underneath (`onCovered`), then the sheet carries on to the opposite corner and leaves (`onDone`).
 * A single continuous motion with a soft ease: no bounce, no artwork. The sheet is oversized so its corners and sides never show.
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

  // One oversized sheet (1.5x the screen diagonal) sweeps corner to corner along the screen diagonal, so only its straight
  // leading and trailing edges are ever seen: Business travels top-right → bottom-left, Personal top-left → bottom-right.
  const diag = Math.hypot(width, height);
  const L = diag * 1.5;
  const vx = (business ? -width : width) / diag;
  const vy = height / diag;
  const angle = `${(Math.atan2(vy, vx) * 180) / Math.PI}deg`;
  const reach = L / 2 + diag / 2;
  const palette = palettes[to][mode];
  const tint = mode === 'dark' ? 'rgba(12,14,18,0.62)' : 'rgba(255,255,255,0.58)';
  const sheet = useAnimatedStyle(() => {
    const d = interpolate(p.value, [0, 0.5, 1], [-reach, 0, reach]);
    return { transform: [{ translateX: vx * d }, { translateY: vy * d }, { rotate: angle }] };
  });
  const label = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.34, 0.46, 0.54, 0.66], [0, 1, 1, 0], 'clamp') }));

  return (
    <View pointerEvents="auto" accessibilityViewIsModal accessibilityLiveRegion="polite" accessibilityLabel={business ? t('Espacio Business') : t('Espacio Personal')}
      style={{ position: 'absolute', inset: 0, zIndex: 2000, overflow: 'hidden' } as object}>
      <Animated.View style={[{ position: 'absolute', left: width / 2 - L / 2, top: height / 2 - L / 2, width: L, height: L, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' }, sheet]}>
        <BlurView intensity={Platform.OS === 'web' ? 40 : 34} tint={mode === 'dark' ? 'dark' : 'light'} style={{ position: 'absolute', inset: 0, backgroundColor: tint } as object} />
        <LinearGradient colors={[`${c.accent}2B`, 'rgba(255,255,255,0)', `${c.accent}1A`]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', inset: 0 } as object} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: height / 2 - 24, alignItems: 'center', gap: 10 }, label]}>
        <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: palette.accent }} />
        <Txt v="h3" style={{ color: c.text }}>{business ? t('Espacio Business') : t('Espacio Personal')}</Txt>
      </Animated.View>
    </View>
  );
}
