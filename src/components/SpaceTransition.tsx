import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View, useWindowDimensions } from 'react-native';
import { Space } from '../theme/tokens';
import { Txt } from '../ui';
import { t } from '../i18n';

const native = Platform.OS !== 'web';
const LILAC = '#9B86FF';
const GREEN = '#1FA67A';
const D = 64; // loop diameter
const SPREAD = 34; // distance of each loop from the centre

const step = (v: Animated.Value, toValue: number, duration: number, easing = Easing.out(Easing.cubic)) => Animated.timing(v, { toValue, duration, easing, useNativeDriver: native });

/**
 * CIFRA's signature Personal ⇄ Business switch. The three-dot chat mark appears, its outer dots grow into two linked loops
 * (lilac = Personal, green = Business), and the loop of the space you are going to swells into a soft reveal that covers the app.
 * `onCovered` is called when the reveal covers the screen (swap the space there); then the reveal dissolves into the new inbox and `onDone` fires.
 * Going back plays the same motif mirrored: the destination loop is always the one that expands.
 */
export function SpaceTransition({ to, onCovered, onDone }: { to: Space; onCovered: () => void; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const biz = to === 'business';
  const [a] = useState(() => ({ veil: new Animated.Value(0), dots: new Animated.Value(0), loops: new Animated.Value(0), grow: new Animated.Value(0), label: new Animated.Value(0), out: new Animated.Value(1) }));

  useEffect(() => {
    let live = true;
    Animated.sequence([
      Animated.parallel([step(a.veil, 1, 160, Easing.out(Easing.quad)), step(a.dots, 1, 200, Easing.out(Easing.back(1.8))), step(a.label, 1, 220)]),
      step(a.loops, 1, 260, Easing.inOut(Easing.cubic)),          // dots → two linked loops
      step(a.grow, 1, 360, Easing.in(Easing.cubic)),               // the destination loop swells into the reveal
    ]).start(({ finished }) => {
      if (!finished || !live) return;
      onCovered();
      setTimeout(() => { if (live) Animated.timing(a.out, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: native }).start(() => live && onDone()); }, 140);
    });
    return () => { live = false; };
  }, [a, onCovered, onDone]);

  const dir = biz ? 1 : -1; // the destination loop sits on the right for Business, on the left for Personal
  const cover = (Math.hypot(width, height) * 2.4) / D;
  const loopMove = (side: 1 | -1) => a.loops.interpolate({ inputRange: [0, 1], outputRange: [side * 22, side * SPREAD] });
  const ring = (side: 1 | -1, color: string, destination: boolean) => (
    <Animated.View key={side} style={{ position: 'absolute', width: D, height: D, marginLeft: -D / 2, marginTop: -D / 2, opacity: a.loops, transform: [{ translateX: loopMove(side) }, { scale: a.loops.interpolate({ inputRange: [0, 1], outputRange: [0.22, 1] }) }] }}>
      <View style={{ flex: 1, borderRadius: D / 2, borderWidth: 7, borderColor: color, shadowColor: color, shadowOpacity: 0.7, shadowRadius: 14 }} />
      {destination && <Animated.View style={{ position: 'absolute', inset: 0, borderRadius: D / 2, opacity: a.grow.interpolate({ inputRange: [0, 0.15], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ scale: a.grow.interpolate({ inputRange: [0, 1], outputRange: [0.8, cover] }) }] } as object}>
        <LinearGradient colors={biz ? ['#166B52', '#0A3B2C'] : ['#C8BCFF', '#9B86FF']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1, borderRadius: D / 2 }} />
      </Animated.View>}
    </Animated.View>
  );
  const dot = (side: 1 | -1 | 0, color: string) => (
    <Animated.View key={side} style={{ position: 'absolute', width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: 7, backgroundColor: color, opacity: a.dots.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) , transform: [{ translateX: side * 22 }, { scale: Animated.multiply(a.dots, a.loops.interpolate({ inputRange: [0, 1], outputRange: [1, side === 0 ? 1 : 0.2] })) }] }} />
  );

  return (
    <Animated.View pointerEvents="auto" accessibilityViewIsModal accessibilityLiveRegion="polite" accessibilityLabel={biz ? t('Espacio Business') : t('Espacio Personal')} style={{ position: 'absolute', inset: 0, opacity: a.out, zIndex: 2000 } as object}>
      <Animated.View style={{ position: 'absolute', inset: 0, opacity: a.veil } as object}>
        <BlurView intensity={Platform.OS === 'web' ? 60 : 45} tint="dark" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(12,16,14,0.45)' } as object} />
      </Animated.View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <View style={{ width: 1, height: 1 }}>
          {ring(-1, LILAC, !biz)}
          {ring(1, GREEN, biz)}
          {/* the middle dot becomes the link between the loops */}
          <Animated.View style={{ position: 'absolute', width: 26, height: 12, marginLeft: -13, marginTop: -6, borderRadius: 6, backgroundColor: '#fff', opacity: a.dots, transform: [{ scaleX: a.loops.interpolate({ inputRange: [0, 1], outputRange: [0.54, 1] }) }, { scaleY: a.loops.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }] }} />
          {dot(-1, LILAC)}
          {dot(1, GREEN)}
        </View>
        <Animated.View style={{ position: 'absolute', top: '50%', marginTop: 64, alignItems: 'center', gap: 4, opacity: Animated.multiply(a.label, a.grow.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' })) }}>
          <Txt v="h2" style={{ color: '#fff' }}>{biz ? t('Espacio Business') : t('Espacio Personal')}</Txt>
          <Txt v="small" style={{ color: 'rgba(255,255,255,0.75)' }}>{biz ? t('Bandeja, agenda, clientes y Doer') : t('Tus conversaciones privadas')}</Txt>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
