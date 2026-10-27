import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View, useWindowDimensions } from 'react-native';
import { Space } from '../theme/tokens';
import { Txt } from '../ui';
import { t } from '../i18n';
import { useReducedMotion } from '../lib/motion';

const native = Platform.OS !== 'web';
const PERSONAL = '#9B86FF';
const BUSINESS = '#1FA67A';

const timing = (value: Animated.Value, toValue: number, duration: number, easing = Easing.out(Easing.cubic)) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: native });

/**
 * A directional ribbon moves in from the destination space, then opens into a soft diagonal wave.
 * onCovered changes the space only after the old screen is fully covered; onDone removes the veil.
 */
export function SpaceTransition({ to, onCovered, onDone }: { to: Space; onCovered: () => void; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const business = to === 'business';
  const [motion] = useState(() => ({
    veil: new Animated.Value(0),
    mark: new Animated.Value(0),
    ribbonIn: new Animated.Value(0),
    wave: new Animated.Value(0),
    label: new Animated.Value(0),
    out: new Animated.Value(1),
  }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    const enterDuration = reducedMotion ? 120 : 260;
    const revealDuration = reducedMotion ? 1 : 540;
    Animated.sequence([
      Animated.parallel([
        timing(motion.veil, 1, reducedMotion ? 100 : 220, Easing.out(Easing.quad)),
        timing(motion.mark, 1, reducedMotion ? 100 : 220, Easing.out(Easing.back(1.35))),
        timing(motion.label, 1, enterDuration),
        timing(motion.ribbonIn, 1, reducedMotion ? 1 : 360, Easing.out(Easing.cubic)),
      ]),
      timing(motion.wave, 1, revealDuration, Easing.inOut(Easing.cubic)),
    ]).start(({ finished }) => {
      if (!finished || !live) return;
      onCovered();
      timer.current = setTimeout(() => {
        if (!live) return;
        Animated.timing(motion.out, {
          toValue: 0,
          duration: reducedMotion ? 120 : 360,
          easing: Easing.out(Easing.quad),
          useNativeDriver: native,
        }).start(({ finished: faded }) => { if (faded && live) onDone(); });
      }, reducedMotion ? 0 : 100);
    });

    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
      motion.veil.stopAnimation();
      motion.mark.stopAnimation();
      motion.ribbonIn.stopAnimation();
      motion.wave.stopAnimation();
      motion.label.stopAnimation();
      motion.out.stopAnimation();
    };
  }, [motion, onCovered, onDone, reducedMotion]);

  const direction = business ? 1 : -1;
  const diagonal = Math.hypot(width, height);
  const ribbonWidth = Math.max(diagonal * 2.4, width * 2.4);
  const ribbonHeight = Math.max(36, Math.min(56, width * 0.12));
  const expand = motion.wave.interpolate({ inputRange: [0, 1], outputRange: [0.035, (diagonal * 2.4) / ribbonHeight] });
  const colors = business
    ? ['#102A23', '#1FA67A', '#C9F4E3', '#1FA67A', '#102A23'] as const
    : ['#201A46', '#7861E8', '#D8D0FF', '#9B86FF', '#201A46'] as const;
  const labelOpacity = Animated.multiply(
    motion.label,
    motion.wave.interpolate({ inputRange: [0, 0.18], outputRange: [1, 0], extrapolate: 'clamp' }),
  );

  return (
    <Animated.View pointerEvents="auto" accessibilityViewIsModal accessibilityLiveRegion="polite"
      accessibilityLabel={business ? t('Espacio Business') : t('Espacio Personal')}
      style={{ position: 'absolute', inset: 0, opacity: motion.out, zIndex: 2000 } as object}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: motion.veil } as object}>
        <BlurView intensity={Platform.OS === 'web' ? 28 : 24} tint="dark"
          {...(Platform.OS === 'android' ? { blurMethod: 'dimezisBlurViewSdk31Plus' as const } : {})}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(9,15,13,0.64)' } as object} />
      </Animated.View>

      <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Animated.View style={{
          position: 'absolute',
          width: ribbonWidth,
          height: ribbonHeight,
          left: (width - ribbonWidth) / 2,
          top: (height - ribbonHeight) / 2,
          borderRadius: ribbonHeight / 2,
          overflow: 'hidden',
          opacity: motion.ribbonIn.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateX: motion.ribbonIn.interpolate({ inputRange: [0, 1], outputRange: [direction * width * 0.42, 0] }) },
            { rotate: business ? '-18deg' : '18deg' },
            { scaleY: expand },
          ],
        } as object}>
          <LinearGradient colors={colors} locations={[0, 0.23, 0.5, 0.77, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          <Animated.View style={{
            position: 'absolute', top: 0, bottom: 0, width: 140,
            opacity: motion.wave.interpolate({ inputRange: [0, 0.24, 0.7], outputRange: [0, 0.75, 0], extrapolate: 'clamp' }),
            transform: [{ translateX: motion.wave.interpolate({ inputRange: [0, 1], outputRange: [-140, ribbonWidth] }) }],
          } as object}>
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.48)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        </Animated.View>

        <Animated.View style={{
          width: 66, height: 66, alignItems: 'center', justifyContent: 'center',
          opacity: motion.mark.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
          transform: [{ scale: motion.mark.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
        }}>
          <View style={{
            width: 58, height: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
            backgroundColor: business ? 'rgba(31,166,122,0.2)' : 'rgba(155,134,255,0.2)',
            borderWidth: 1, borderColor: business ? 'rgba(143,231,195,0.4)' : 'rgba(211,202,255,0.45)',
            shadowColor: business ? BUSINESS : PERSONAL, shadowOpacity: 0.7, shadowRadius: 22, shadowOffset: { width: 0, height: 0 },
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {[0, 1, 2].map((i) => <View key={i} style={{
                width: i === 1 ? 8 : 6, height: i === 1 ? 8 : 6, borderRadius: 5,
                backgroundColor: business ? (i === 1 ? '#D5F8E8' : BUSINESS) : (i === 1 ? '#F2EEFF' : PERSONAL),
              }} />)}
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{
          position: 'absolute', top: '50%', marginTop: 60, alignItems: 'center', gap: 5,
          opacity: labelOpacity,
          transform: [{ translateY: motion.label.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }}>
          <Txt v="h2" style={{ color: '#fff' }}>{business ? t('Espacio Business') : t('Espacio Personal')}</Txt>
          <Txt v="small" style={{ color: 'rgba(255,255,255,0.78)' }}>{business ? t('Bandeja, agenda, clientes y Doer') : t('Tus conversaciones privadas')}</Txt>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
