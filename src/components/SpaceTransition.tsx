import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { takeSpaceTransitionOrigin, useReducedMotion } from '../lib/motion';
import { accentOptions, bizAccentOptions, palettes, Space } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { t } from '../i18n';
import { SpaceHero } from './SpaceHero';

const PERSONAL = '#9B86FF';
const BUSINESS = '#0E4B3A';

/**
 * The active selector pill stretches into a diagonal colour wave (Reanimated, UI thread), the 3D hero springs in over it,
 * the workspace changes underneath (`onCovered`), then the wave dissolves into the new inbox (`onDone`).
 */
export function SpaceTransition({ to, onCovered, onDone }: { to: Space; onCovered: () => void; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const { mode, accent, bizAccent } = useTheme();
  const reducedMotion = useReducedMotion();
  const business = to === 'business';
  const originRef = useRef(takeSpaceTransitionOrigin());
  const origin = originRef.current ?? { x: width * 0.75, y: height * 0.14, width: Math.min(width * 0.42, 180), height: 38 };
  const progress = useSharedValue(0);
  const out = useSharedValue(1);
  const [cb] = useState(() => ({ covered: onCovered, done: onDone }));
  cb.covered = onCovered; cb.done = onDone;

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => { if (live) cb.done(); };
    const covered = () => {
      if (!live) return;
      cb.covered();
      timer = setTimeout(() => { out.value = withTiming(0, { duration: reducedMotion ? 100 : 340, easing: Easing.out(Easing.quad) }, (f) => { if (f) scheduleOnRN(finish); }); }, reducedMotion ? 0 : 70);
    };
    progress.value = withTiming(1, { duration: reducedMotion ? 120 : 880, easing: Easing.bezier(0.65, 0, 0.35, 1) }, (f) => { if (f) scheduleOnRN(covered); });
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [progress, out, cb, reducedMotion]);

  const palette = palettes[to][mode];
  const personalAccent = accentOptions.find((option) => option.key === accent)?.swatch ?? PERSONAL;
  const businessAccent = bizAccentOptions.find((option) => option.key === bizAccent)?.swatch ?? BUSINESS;
  const targetAccent = business ? businessAccent : personalAccent;
  const startWidth = Math.max(88, origin.width);
  const startHeight = Math.max(32, origin.height);
  const diagonal = Math.hypot(width, height);
  const waveWidth = diagonal * 4.2;
  const waveHeight = diagonal * 2.8;
  const dir = business ? -1 : 1;
  const waveColors = business
    ? [personalAccent, '#C5B7FF', '#F8F6FC', '#E9F2EC', '#8AC4A7', businessAccent] as const
    : [businessAccent, '#8AC4A7', '#F7F5FB', '#E7E1FF', '#C5B7FF', personalAccent] as const;

  const root = useAnimatedStyle(() => ({ opacity: out.value }));
  const veil = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 0.18, 0.62, 1], [0, 0.04, 0.2, 0.88]) }));
  const wave = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { scaleX: interpolate(p, [0, 0.14, 0.36, 1], [1, 1.48, 3.6, waveWidth / startWidth], Extrapolation.CLAMP) },
        { scaleY: interpolate(p, [0, 0.14, 0.36, 1], [1, 1.08, 2.7, waveHeight / startHeight], Extrapolation.CLAMP) },
        { rotate: `${interpolate(p, [0, 0.14, 0.36, 1], [0, 0, dir * 19, dir * 34], Extrapolation.CLAMP)}deg` },
        { translateX: interpolate(p, [0, 0.2, 1], [0, (width / 2 - origin.x) * 0.22, width / 2 - origin.x], Extrapolation.CLAMP) },
        { translateY: interpolate(p, [0, 0.2, 1], [0, (height / 2 - origin.y) * 0.16, height / 2 - origin.y], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="auto" accessibilityViewIsModal accessibilityLiveRegion="polite"
      accessibilityLabel={business ? t('Espacio Business') : t('Espacio Personal')}
      style={[{ position: 'absolute', inset: 0, zIndex: 2000 } as object, root]}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0, backgroundColor: palette.bg } as object, veil]} />
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', left: origin.x - startWidth / 2, top: origin.y - startHeight / 2, width: startWidth, height: startHeight,
        borderRadius: startHeight / 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.74)', backgroundColor: targetAccent,
      } as object, wave]}>
        <LinearGradient colors={waveColors} locations={[0, 0.2, 0.42, 0.57, 0.78, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>
      {!reducedMotion && <SpaceHero to={to} progress={progress} />}
    </Animated.View>
  );
}
