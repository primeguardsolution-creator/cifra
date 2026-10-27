import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { Space } from '../theme/tokens';
import { Txt } from '../ui';
import { t } from '../i18n';

const native = Platform.OS !== 'web';

/** A looping 0 → 1 value. */
function useLoop(duration: number, delay = 0, easing: (v: number) => number = Easing.linear) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: native }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: native })]));
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay, easing]);
  return v;
}
/** Smooth 0 ↔ 1 back and forth. */
function usePingPong(duration: number, delay = 0) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }), Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native })]));
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);
  return v;
}

const COINS = ['€', '$', '£', '¥', '€', '$', '£'];

function Coin({ symbol, index }: { symbol: string; index: number }) {
  const p = useLoop(1500, index * 210, Easing.in(Easing.quad));
  const x = -92 + ((index * 53) % 184);
  const size = 30 + (index % 3) * 4;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 0, left: 150 - size / 2 + x * 0.55, width: size, height: size, opacity: p.interpolate({ inputRange: [0, 0.08, 0.82, 1], outputRange: [0, 1, 1, 0] }),
      transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-10, 150] }) }, { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, -x * 0.55] }) }, { perspective: 400 }, { rotateY: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${720 + index * 90}deg`] }) }, { scale: p.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 0.9, 0.35] }) }],
    }}>
      <LinearGradient colors={['#FFE27A', '#F5A524', '#B8740A']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1, borderRadius: size / 2, borderWidth: 2, borderColor: '#FFD25A', alignItems: 'center', justifyContent: 'center', shadowColor: '#F5A524', shadowOpacity: 0.7, shadowRadius: 10 }}>
        <Txt style={{ color: '#7A4A00', fontSize: size * 0.5, lineHeight: size * 0.6, fontFamily: 'Inter_700Bold' }}>{symbol}</Txt>
      </LinearGradient>
    </Animated.View>
  );
}

/** A small shop that turns slowly while coins of several currencies drop in through its door. */
function ShopScene() {
  const turn = usePingPong(1300);
  const bounce = useLoop(1500, 0, Easing.out(Easing.quad));
  const stripes = [0, 1, 2, 3, 4, 5];
  return (
    <View style={{ width: 300, height: 290, alignItems: 'center' }}>
      <Animated.View style={{ position: 'absolute', top: 70, width: 200, height: 190, alignItems: 'center', transform: [{ perspective: 700 }, { rotateY: turn.interpolate({ inputRange: [0, 1], outputRange: ['-22deg', '22deg'] }) }, { scale: bounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.03, 1] }) }] }}>
        <View style={{ position: 'absolute', bottom: -14, width: 190, height: 22, borderRadius: 100, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        <LinearGradient colors={['#F4EBDD', '#D9C9AE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 50, width: 180, height: 130, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }} />
        <View style={{ position: 'absolute', top: 92, left: 24, width: 56, height: 46, borderRadius: 6, backgroundColor: '#9ED8FF', borderWidth: 3, borderColor: '#7C5A2E' }} />
        <LinearGradient colors={['#8B5A24', '#5C3A14']} style={{ position: 'absolute', top: 96, right: 28, width: 52, height: 84, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
          <View style={{ position: 'absolute', right: 8, top: 40, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFD25A' }} />
        </LinearGradient>
        <View style={{ position: 'absolute', top: 24, width: 206, height: 34, flexDirection: 'row', borderTopLeftRadius: 8, borderTopRightRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8 }}>
          {stripes.map((i) => <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? '#FFFFFF' : '#1FA67A' }} />)}
        </View>
        <View style={{ position: 'absolute', top: 56, width: 206, height: 10, flexDirection: 'row' }}>
          {stripes.map((i) => <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? '#FFFFFF' : '#1FA67A', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }} />)}
        </View>
        <View style={{ position: 'absolute', top: 0, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 6, backgroundColor: '#F5A524' }}><Txt style={{ color: '#1A1100', fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold' }}>OPEN</Txt></View>
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: 300, height: 290 }}>{COINS.map((s, i) => <Coin key={i} symbol={s} index={i} />)}</View>
    </View>
  );
}

function Bubble({ phase, side }: { phase: number; side: 'left' | 'right' }) {
  const p = useLoop(2400, 0);
  const a = phase * 0.5;
  const show = p.interpolate({ inputRange: [a, a + 0.06, a + 0.4, a + 0.5, 1].map((x) => Math.min(x, 1)), outputRange: [0, 1, 1, 0, 0] });
  const dots = [0, 1, 2];
  return (
    <Animated.View style={{ position: 'absolute', top: 18, [side]: 18, opacity: show, transform: [{ scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] } as object}>
      <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18, backgroundColor: side === 'left' ? '#FFFFFF' : '#9B86FF' }}>
        {dots.map((d) => <View key={d} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: side === 'left' ? '#6B5BD6' : '#fff', opacity: 0.55 + d * 0.2 }} />)}
      </View>
    </Animated.View>
  );
}

function Person({ colors, flip, delay }: { colors: [string, string]; flip?: boolean; delay: number }) {
  const bob = usePingPong(650, delay);
  const turn = usePingPong(1200, 0);
  const dir = flip ? -1 : 1;
  return (
    <Animated.View style={{ width: 96, alignItems: 'center', transform: [{ perspective: 600 }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }, { rotateY: turn.interpolate({ inputRange: [0, 1], outputRange: [`${dir * 8}deg`, `${dir * 26}deg`] }) }, { rotateZ: bob.interpolate({ inputRange: [0, 1], outputRange: [`${dir * -2}deg`, `${dir * 4}deg`] }) }] }}>
      <LinearGradient colors={['#FFE0C2', '#E8B48A']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ width: 52, height: 52, borderRadius: 26, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
        <View style={{ position: 'absolute', top: 0, width: 52, height: 22, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: flip ? '#3A2A22' : '#8A4B2A' }} />
      </LinearGradient>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ marginTop: 5, width: 84, height: 96, borderTopLeftRadius: 42, borderTopRightRadius: 42, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, shadowColor: colors[1], shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }} />
    </Animated.View>
  );
}

/** Two people talking: they lean toward each other and take turns with the speech bubbles. */
function ChatScene() {
  return (
    <View style={{ width: 300, height: 290, alignItems: 'center' }}>
      <Bubble phase={0} side="left" />
      <Bubble phase={1} side="right" />
      <View style={{ position: 'absolute', top: 92, flexDirection: 'row', gap: 22, alignItems: 'flex-end' }}>
        <Person colors={['#B7A6FF', '#6B5BD6']} delay={0} />
        <Person colors={['#7FE3C0', '#1FA67A']} flip delay={325} />
      </View>
      <View style={{ position: 'absolute', bottom: 24, width: 230, height: 22, borderRadius: 100, backgroundColor: 'rgba(0,0,0,0.3)' }} />
    </View>
  );
}

/** Full-screen overlay for the Personal ⇄ Business switch: a blurred, see-through veil with a moving 3D scene. */
export function SpaceTransition({ to, opacity }: { to: Space; opacity: Animated.Value }) {
  const biz = to === 'business';
  return (
    <Animated.View pointerEvents="auto" accessibilityViewIsModal accessibilityLabel={biz ? t('Espacio Business') : t('Espacio Personal')} style={{ position: 'absolute', inset: 0, opacity, zIndex: 2000 } as object}>
      <BlurView intensity={Platform.OS === 'web' ? 70 : 55} tint="dark" style={{ position: 'absolute', inset: 0, backgroundColor: biz ? 'rgba(16,12,4,0.38)' : 'rgba(20,12,56,0.38)' } as object} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {biz ? <ShopScene /> : <ChatScene />}
        <Txt v="h2" style={{ color: '#fff', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 10 }}>{biz ? t('Espacio Business') : t('Espacio Personal')}</Txt>
        <Txt v="small" style={{ color: 'rgba(255,255,255,0.8)', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8 }}>{biz ? t('Bandeja, agenda, clientes y Doer') : t('Tus conversaciones privadas')}</Txt>
      </View>
    </Animated.View>
  );
}
