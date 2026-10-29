import { useEffect } from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, SharedValue, interpolate, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Space } from '../theme/tokens';

const art = {
  shop: require('../../assets/art/shop.webp'),
  coins: [require('../../assets/art/coin-eur.webp'), require('../../assets/art/coin-usd.webp'), require('../../assets/art/coin-gbp.webp'), require('../../assets/art/coin-jpy.webp'), require('../../assets/art/coin-inr.webp'), require('../../assets/art/coin-krw.webp')],
  lilac: require('../../assets/art/person-lilac.webp'),
  green: require('../../assets/art/person-green.webp'),
  bubbleL: require('../../assets/art/bubble-left.webp'),
  bubbleR: require('../../assets/art/bubble-right.webp'),
};

const SPRING = { damping: 11, stiffness: 130, mass: 0.9 };
const SOFT = { damping: 16, stiffness: 120, mass: 0.85 };

/** Idle float 0 ↔ 1, runs on the UI thread. */
function useIdle(duration: number, delay = 0) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })), -1));
  }, [v, duration, delay]);
  return v;
}

/** A spring that fires once the transition clock passes `at` (0..1): real overshoot, not a keyframe. */
function useSpringAt(progress: SharedValue<number>, at: number, config = SPRING) {
  const v = useSharedValue(0);
  useAnimatedReaction(() => progress.value >= at, (now, before) => { if (now && !before) v.value = withSpring(1, config); });
  return v;
}

function Coin({ i, size, fall }: { i: number; size: number; fall: number }) {
  const c = useSharedValue(0);
  useEffect(() => { c.value = withDelay(80 + i * 170, withRepeat(withTiming(1, { duration: 1100, easing: Easing.in(Easing.quad) }), -1, false)); }, [c, i]);
  const x = (((i * 37) % 5) - 2) * size * 0.32;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(c.value, [0, 0.1, 0.82, 1], [0, 1, 1, 0]),
    transform: [{ translateY: interpolate(c.value, [0, 1], [-size, fall]) }, { perspective: 500 }, { rotateY: `${interpolate(c.value, [0, 1], [0, 540 + i * 60])}deg` }, { scale: interpolate(c.value, [0, 1], [1, 0.55]) }],
  }));
  return <Animated.Image source={art.coins[i % art.coins.length]} resizeMode="contain" style={[{ position: 'absolute', top: 0, left: '50%', width: size, height: size, marginLeft: -size / 2 + x }, style]} />;
}

function Shop({ progress, w }: { progress: SharedValue<number>; w: number }) {
  const enter = useSpringAt(progress, 0.26);
  const bob = useIdle(1500, 300);
  const h = w * (713 / 720);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.35], [0, 1], 'clamp'),
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [90, 0]) + interpolate(bob.value, [0, 1], [0, -8]) },
      { scale: interpolate(enter.value, [0, 1], [0.35, 1]) },
      { perspective: 900 }, { rotateY: `${interpolate(bob.value, [0, 1], [-6, 6])}deg` }, { rotateZ: `${interpolate(enter.value, [0, 1], [-10, 0])}deg` },
    ],
  }));
  return (
    <Animated.View style={[{ width: w, height: h }, style]}>
      <View style={{ position: 'absolute', bottom: -h * 0.02, left: w * 0.12, right: w * 0.08, height: h * 0.07, borderRadius: 100, backgroundColor: 'rgba(10,40,30,0.28)' }} />
      <Image source={art.shop} resizeMode="contain" style={{ width: w, height: h }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: h * 0.02, left: w * 0.3, width: w * 0.4, height: h * 0.6 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <Coin key={i} i={i} size={w * 0.15} fall={h * 0.6} />)}
      </View>
    </Animated.View>
  );
}

function Person({ source, aspect, w, side, progress, delay }: { source: number; aspect: number; w: number; side: 1 | -1; progress: SharedValue<number>; delay: number }) {
  const enter = useSpringAt(progress, side === -1 ? 0.24 : 0.3, SOFT);
  const sway = useIdle(1100, delay);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.3], [0, 1], 'clamp'),
    transform: [
      { translateX: interpolate(enter.value, [0, 1], [side * w * 1.1, 0]) },
      { translateY: interpolate(sway.value, [0, 1], [0, -6]) },
      { perspective: 900 }, { rotateY: `${interpolate(sway.value, [0, 1], [side * -7, side * 9])}deg` }, { rotateZ: `${interpolate(sway.value, [0, 1], [-1, 1.5])}deg` },
    ],
  }));
  return <Animated.View style={[{ width: w, height: w * aspect }, style]}><Image source={source} resizeMode="contain" style={{ width: w, height: w * aspect }} /></Animated.View>;
}

function Bubble({ source, w, h, left, top, progress, at }: { source: number; w: number; h: number; left: number; top: number; progress: SharedValue<number>; at: number }) {
  const pop = useSpringAt(progress, at, { damping: 9, stiffness: 190, mass: 0.7 });
  const bob = useIdle(900, 200);
  const style = useAnimatedStyle(() => ({ opacity: interpolate(pop.value, [0, 0.3], [0, 1], 'clamp'), transform: [{ translateY: interpolate(bob.value, [0, 1], [0, -4]) }, { scale: interpolate(pop.value, [0, 1], [0.2, 1]) }] }));
  return <Animated.Image source={source} resizeMode="contain" style={[{ position: 'absolute', left, top, width: w, height: h }, style]} />;
}

/**
 * Pixar-style 3D hero for the Personal ⇄ Business switch: the Business shop (coins dropping into the door) or two friends chatting.
 * `progress` is the transition's clock (a Reanimated shared value); each piece springs in on the UI thread once the clock passes its cue.
 */
export function SpaceHero({ to, progress }: { to: Space; progress: SharedValue<number> }) {
  const { width, height } = useWindowDimensions();
  const base = Math.min(width * 0.9, height * 0.5, 460);
  if (to === 'business') {
    return <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}><Shop progress={progress} w={base} /></View>;
  }
  const pw = base * 0.5;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}>
      <View style={{ width: pw * 2.05, height: pw * 2.05 * 0.98, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>
        <Person source={art.lilac} aspect={989 / 486} w={pw * 0.98} side={-1} progress={progress} delay={0} />
        <Person source={art.green} aspect={930 / 520} w={pw * 1.05} side={1} progress={progress} delay={400} />
        <Bubble source={art.bubbleL} w={pw * 0.42} h={pw * 0.42 * (142 / 181)} left={pw * 0.02} top={-pw * 0.32} progress={progress} at={0.56} />
        <Bubble source={art.bubbleR} w={pw * 0.42} h={pw * 0.42 * (156 / 179)} left={pw * 1.42} top={-pw * 0.2} progress={progress} at={0.68} />
      </View>
    </View>
  );
}
