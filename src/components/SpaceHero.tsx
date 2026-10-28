import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, View, useWindowDimensions } from 'react-native';
import { Space } from '../theme/tokens';

const native = Platform.OS !== 'web';
const art = {
  shop: require('../../assets/art/shop.webp'),
  coins: [require('../../assets/art/coin-eur.webp'), require('../../assets/art/coin-usd.webp'), require('../../assets/art/coin-gbp.webp'), require('../../assets/art/coin-jpy.webp'), require('../../assets/art/coin-inr.webp'), require('../../assets/art/coin-krw.webp')],
  lilac: require('../../assets/art/person-lilac.webp'),
  green: require('../../assets/art/person-green.webp'),
  bubbleL: require('../../assets/art/bubble-left.webp'),
  bubbleR: require('../../assets/art/bubble-right.webp'),
};

/** A 0 → 1 → 0 value that keeps going: gives the 3D art a gentle idle float. */
function useFloat(duration: number, delay = 0) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);
  return v;
}
/** A 0 → 1 value that repeats (for things that fall). */
function useCycle(duration: number, delay: number, easing = Easing.in(Easing.quad)) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: native }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: native })]));
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay, easing]);
  return v;
}

const pop = (p: Animated.Value, from: number, to: number) => p.interpolate({ inputRange: [from, from + (to - from) * 0.62, to], outputRange: [0, 1.08, 1], extrapolate: 'clamp' });

function Coin({ i, size, fall }: { i: number; size: number; fall: number }) {
  const c = useCycle(1100, 80 + i * 170);
  const x = ((i * 37) % 5 - 2) * size * 0.32;
  return (
    <Animated.Image source={art.coins[i % art.coins.length]} resizeMode="contain" style={{
      position: 'absolute', top: 0, left: '50%', width: size, height: size, marginLeft: -size / 2 + x,
      opacity: c.interpolate({ inputRange: [0, 0.1, 0.82, 1], outputRange: [0, 1, 1, 0] }),
      transform: [{ translateY: c.interpolate({ inputRange: [0, 1], outputRange: [-size, fall] }) }, { perspective: 500 }, { rotateY: c.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${540 + i * 60}deg`] }) }, { scale: c.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) }],
    }} />
  );
}

function Shop({ progress, w }: { progress: Animated.Value; w: number }) {
  const bob = useFloat(1500);
  const h = w * (713 / 720);
  const enter = progress.interpolate({ inputRange: [0.28, 0.56, 0.7], outputRange: [0.5, 1.07, 1], extrapolate: 'clamp' });
  const rise = progress.interpolate({ inputRange: [0.28, 0.62], outputRange: [60, 0], extrapolate: 'clamp' });
  const alpha = progress.interpolate({ inputRange: [0.26, 0.42], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View style={{ width: w, height: h, opacity: alpha, transform: [{ translateY: rise }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }, { scale: enter }, { perspective: 900 }, { rotateY: bob.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) }] }}>
      <View style={{ position: 'absolute', bottom: -h * 0.02, left: w * 0.12, right: w * 0.08, height: h * 0.07, borderRadius: 100, backgroundColor: 'rgba(10,40,30,0.28)' }} />
      <Image source={art.shop} resizeMode="contain" style={{ width: w, height: h }} />
      {/* coins drop in front of the door */}
      <View pointerEvents="none" style={{ position: 'absolute', top: h * 0.02, left: w * 0.3, width: w * 0.4, height: h * 0.6 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <Coin key={i} i={i} size={w * 0.15} fall={h * 0.6} />)}
      </View>
    </Animated.View>
  );
}

function Person({ source, aspect, w, side, progress, delay }: { source: number; aspect: number; w: number; side: 1 | -1; progress: Animated.Value; delay: number }) {
  const sway = useFloat(1100, delay);
  const slide = progress.interpolate({ inputRange: [0.26, 0.58], outputRange: [side * w * 0.9, 0], extrapolate: 'clamp' });
  const alpha = progress.interpolate({ inputRange: [0.26, 0.4], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View style={{ width: w, height: w * aspect, opacity: alpha, transform: [{ translateX: slide }, { translateY: sway.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { perspective: 900 }, { rotateY: sway.interpolate({ inputRange: [0, 1], outputRange: [`${side * -6}deg`, `${side * 8}deg`] }) }, { rotateZ: sway.interpolate({ inputRange: [0, 1], outputRange: ['-1deg', '1.5deg'] }) }] }}>
      <Image source={source} resizeMode="contain" style={{ width: w, height: w * aspect }} />
    </Animated.View>
  );
}

function Bubble({ source, w, h, left, top, progress, at }: { source: number; w: number; h: number; left: number; top: number; progress: Animated.Value; at: number }) {
  const s = pop(progress, at, at + 0.2);
  return <Animated.Image source={source} resizeMode="contain" style={{ position: 'absolute', left, top, width: w, height: h, opacity: s.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ scale: s }] }} />;
}

/**
 * Pixar-style 3D hero for the Personal ⇄ Business switch: the Business shop (with coins dropping into its door) or two friends chatting.
 * `progress` is the transition's own 0 → 1 clock, so the art lands while the colour wash covers the screen.
 */
export function SpaceHero({ to, progress }: { to: Space; progress: Animated.Value }) {
  const { width, height } = useWindowDimensions();
  const base = Math.min(width * 0.9, height * 0.5, 460);
  if (to === 'business') {
    return <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}><Shop progress={progress} w={base} /></View>;
  }
  const pw = base * 0.5; // each person ~half the stage
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}>
      <View style={{ width: pw * 2.05, height: pw * 2.05 * 0.98, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>
        <Person source={art.lilac} aspect={989 / 486} w={pw * 0.98} side={-1} progress={progress} delay={0} />
        <Person source={art.green} aspect={930 / 520} w={pw * 1.05} side={1} progress={progress} delay={400} />
        <Bubble source={art.bubbleL} w={pw * 0.42} h={pw * 0.42 * (142 / 181)} left={pw * 0.02} top={-pw * 0.32} progress={progress} at={0.58} />
        <Bubble source={art.bubbleR} w={pw * 0.42} h={pw * 0.42 * (156 / 179)} left={pw * 1.42} top={-pw * 0.2} progress={progress} at={0.7} />
      </View>
    </View>
  );
}
