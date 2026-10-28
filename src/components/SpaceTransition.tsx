import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View, useWindowDimensions } from 'react-native';
import { takeSpaceTransitionOrigin, useReducedMotion } from '../lib/motion';
import { accentOptions, bizAccentOptions, palettes, Space } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { t } from '../i18n';
import { SpaceHero } from './SpaceHero';

const native = Platform.OS !== 'web';
const PERSONAL = '#9B86FF';
const BUSINESS = '#0E4B3A';

/**
 * The active selector pill stretches into the diagonal color wave, which covers the old inbox
 * before the workspace changes and settles into the destination inbox.
 */
export function SpaceTransition({ to, onCovered, onDone }: { to: Space; onCovered: () => void; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const { mode, accent, bizAccent } = useTheme();
  const reducedMotion = useReducedMotion();
  const business = to === 'business';
  const originRef = useRef(takeSpaceTransitionOrigin());
  const origin = originRef.current ?? { x: width * 0.75, y: height * 0.14, width: Math.min(width * 0.42, 180), height: 38 };
  const [motion] = useState(() => ({
    progress: new Animated.Value(0),
    out: new Animated.Value(1),
  }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    Animated.timing(motion.progress, {
      toValue: 1,
      duration: reducedMotion ? 120 : 880,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: native,
    }).start(({ finished }) => {
      if (!finished || !live) return;
      onCovered();
      timer.current = setTimeout(() => {
        if (!live) return;
        Animated.timing(motion.out, {
          toValue: 0,
          duration: reducedMotion ? 100 : 340,
          easing: Easing.out(Easing.quad),
          useNativeDriver: native,
        }).start(({ finished: faded }) => { if (faded && live) onDone(); });
      }, reducedMotion ? 0 : 70);
    });

    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
      motion.progress.stopAnimation();
      motion.out.stopAnimation();
    };
  }, [motion, onCovered, onDone, reducedMotion]);

  const palette = palettes[to][mode];
  const personalAccent = accentOptions.find((option) => option.key === accent)?.swatch ?? PERSONAL;
  const businessAccent = bizAccentOptions.find((option) => option.key === bizAccent)?.swatch ?? BUSINESS;
  const targetAccent = business ? businessAccent : personalAccent;
  const startWidth = Math.max(88, origin.width);
  const startHeight = Math.max(32, origin.height);
  const diagonal = Math.hypot(width, height);
  const waveWidth = diagonal * 4.2;
  const waveHeight = diagonal * 2.8;
  const angle = business ? -34 : 34;
  const waveColors = business
    ? [personalAccent, '#C5B7FF', '#F8F6FC', '#E9F2EC', '#8AC4A7', businessAccent] as const
    : [businessAccent, '#8AC4A7', '#F7F5FB', '#E7E1FF', '#C5B7FF', personalAccent] as const;

  const scaleX = motion.progress.interpolate({
    inputRange: [0, 0.14, 0.36, 1],
    outputRange: [1, 1.48, 3.6, waveWidth / startWidth],
  });
  const scaleY = motion.progress.interpolate({
    inputRange: [0, 0.14, 0.36, 1],
    outputRange: [1, 1.08, 2.7, waveHeight / startHeight],
  });
  const rotate = motion.progress.interpolate({
    inputRange: [0, 0.14, 0.36, 1],
    outputRange: ['0deg', '0deg', business ? '-19deg' : '19deg', business ? '-34deg' : '34deg'],
  });
  const translateX = motion.progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, (width / 2 - origin.x) * 0.22, width / 2 - origin.x] });
  const translateY = motion.progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, (height / 2 - origin.y) * 0.16, height / 2 - origin.y] });
  const recede = motion.progress.interpolate({ inputRange: [0, 0.18, 0.62, 1], outputRange: [0, 0.04, 0.2, 0.88] });

  return (
    <Animated.View pointerEvents="auto" accessibilityViewIsModal accessibilityLiveRegion="polite"
      accessibilityLabel={business ? t('Espacio Business') : t('Espacio Personal')}
      style={{ position: 'absolute', inset: 0, opacity: motion.out, zIndex: 2000 } as object}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: recede, backgroundColor: palette.bg } as object} />
      <Animated.View pointerEvents="none" style={{
        position: 'absolute',
        left: origin.x - startWidth / 2,
        top: origin.y - startHeight / 2,
        width: startWidth,
        height: startHeight,
        borderRadius: startHeight / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.74)',
        backgroundColor: targetAccent,
        transform: [
          { scaleX },
          { scaleY },
          { rotate },
          { translateX },
          { translateY },
        ],
      } as object}>
        <LinearGradient
          colors={waveColors}
          locations={[0, 0.2, 0.42, 0.57, 0.78, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      {!reducedMotion && <SpaceHero to={to} progress={motion.progress} />}
    </Animated.View>
  );
}
