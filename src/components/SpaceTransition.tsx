import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View, useWindowDimensions } from 'react-native';
import { useReducedMotion, takeSpaceTransitionOrigin } from '../lib/motion';
import { palettes, Space } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Txt } from '../ui';
import { t } from '../i18n';

const native = Platform.OS !== 'web';
const PERSONAL = '#9B86FF';
const BUSINESS = '#1FA67A';

/**
 * The destination colour washes through from the tapped space switch. The workspace swaps beneath
 * the colour veil, then the new screen comes into focus. No layout or space-switch behavior changes.
 */
export function SpaceTransition({ to, onCovered, onDone }: { to: Space; onCovered: () => void; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const { mode } = useTheme();
  const reducedMotion = useReducedMotion();
  const business = to === 'business';
  const originRef = useRef(takeSpaceTransitionOrigin());
  const origin = originRef.current ?? { x: width / 2, y: height * 0.14 };
  const [motion] = useState(() => ({
    wash: new Animated.Value(0),
    sweep: new Animated.Value(0),
    label: new Animated.Value(0),
    out: new Animated.Value(1),
  }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    const duration = reducedMotion ? 120 : 760;
    Animated.parallel([
      Animated.timing(motion.wash, {
        toValue: 1,
        duration: reducedMotion ? 100 : 610,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: native,
      }),
      Animated.timing(motion.sweep, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: native,
      }),
      Animated.sequence([
        Animated.delay(reducedMotion ? 0 : 120),
        Animated.timing(motion.label, {
          toValue: 1,
          duration: reducedMotion ? 80 : 330,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: native,
        }),
        Animated.delay(reducedMotion ? 0 : 120),
        Animated.timing(motion.label, {
          toValue: 0,
          duration: reducedMotion ? 20 : 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: native,
        }),
      ]),
    ]).start(({ finished }) => {
      if (!finished || !live) return;
      onCovered();
      timer.current = setTimeout(() => {
        if (!live) return;
        Animated.timing(motion.out, {
          toValue: 0,
          duration: reducedMotion ? 100 : 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: native,
        }).start(({ finished: faded }) => { if (faded && live) onDone(); });
      }, reducedMotion ? 0 : 70);
    });

    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
      motion.wash.stopAnimation();
      motion.sweep.stopAnimation();
      motion.label.stopAnimation();
      motion.out.stopAnimation();
    };
  }, [motion, onCovered, onDone, reducedMotion]);

  const palette = palettes[to][mode];
  const washColors = business
    ? ['rgba(155,134,255,0.18)', 'rgba(31,166,122,0.2)', palette.bg] as const
    : ['rgba(31,166,122,0.16)', 'rgba(155,134,255,0.22)', palette.bg] as const;
  const targetAccent = business ? BUSINESS : PERSONAL;
  const sourceAccent = business ? PERSONAL : BUSINESS;
  const travel = business ? -1 : 1;
  const bandWidth = Math.max(190, width * 0.62);
  const bandHeight = height * 1.7;
  const travelDistance = width * 1.28;
  const washOpacity = motion.wash.interpolate({ inputRange: [0, 0.78, 1], outputRange: [0, 0.66, 0.96] });
  const sweepOpacity = motion.sweep.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 0.9, 0.72, 0] });

  return (
    <Animated.View pointerEvents="auto" accessibilityViewIsModal accessibilityLiveRegion="polite"
      accessibilityLabel={business ? t('Espacio Business') : t('Espacio Personal')}
      style={{ position: 'absolute', inset: 0, opacity: motion.out, zIndex: 2000 } as object}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: washOpacity } as object}>
        <LinearGradient
          colors={washColors}
          locations={[0, 0.52, 1]}
          start={{ x: business ? 1 : 0, y: 0.15 }}
          end={{ x: business ? 0 : 1, y: 0.9 }}
          style={{ position: 'absolute', inset: 0 }}
        />
        <Animated.View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          opacity: motion.wash.interpolate({ inputRange: [0, 0.38, 1], outputRange: [0, 0.36, 0.12] }),
          backgroundColor: targetAccent,
        }} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={{
        position: 'absolute',
        left: origin.x - bandWidth / 2,
        top: origin.y - bandHeight / 2,
        width: bandWidth,
        height: bandHeight,
        borderRadius: bandWidth / 2,
        overflow: 'hidden',
        opacity: sweepOpacity,
        transform: [
          { translateX: motion.sweep.interpolate({ inputRange: [0, 1], outputRange: [0, travel * travelDistance] }) },
          { rotate: business ? '-11deg' : '11deg' },
          { scaleX: motion.sweep.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.64, 1.08, 0.9] }) },
        ],
      } as object}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', `${targetAccent}55`, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          locations={[0, 0.3, 0.52, 0.68, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={{
        position: 'absolute',
        top: '50%',
        left: 20,
        right: 20,
        alignItems: 'center',
        gap: 5,
        opacity: motion.label,
        transform: [{ translateY: motion.label.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }],
      }}>
        <Txt v="h2" style={{ color: palette.text }}>{business ? t('Espacio Business') : t('Espacio Personal')}</Txt>
        <Txt v="small" style={{ color: palette.textMuted }}>{business ? t('Bandeja, agenda, clientes y Doer') : t('Tus conversaciones privadas')}</Txt>
      </Animated.View>
    </Animated.View>
  );
}
