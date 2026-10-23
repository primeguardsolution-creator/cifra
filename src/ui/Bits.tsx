import { useEffect, useRef } from 'react';
import { Animated, Image, Platform, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { Pressy } from './Pressy';
import { tr } from '../i18n';
import { Txt } from './Txt';

export function Logo({ size = 40, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.225, shadowColor: '#4527D6', shadowOpacity: 0.35, shadowRadius: size * 0.3, shadowOffset: { width: 0, height: size * 0.12 } }, style]} accessibilityLabel="CIFRA" accessibilityRole="image">
      {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
      <Image source={require('../../assets/cifra-logo.png')} style={{ width: size, height: size, borderRadius: size * 0.225 }} />
    </View>
  );
}

export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Logo size={size * 1.5} />
      <Txt style={{ fontFamily: font.mono, fontSize: size, letterSpacing: 3, lineHeight: size * 1.2 }}>CIFRA</Txt>
    </View>
  );
}

export function Badge({ count, tone = 'accent' }: { count: number; tone?: 'accent' | 'muted' }) {
  const { c } = useTheme();
  if (count <= 0) return null;
  return (
    <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: tone === 'accent' ? c.accent : c.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
      <Txt style={{ fontFamily: font.bold, fontSize: 12, lineHeight: 15, color: tone === 'accent' ? c.accentText : c.text }}>{count > 99 ? '99+' : count}</Txt>
    </View>
  );
}

export function Chip({ label, active, onPress, icon, count }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName; count?: number }) {
  const { c, r } = useTheme();
  return (
    <Pressy onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} scale={0.95}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: r(radius.pill > 100 ? 18 : radius.pill), backgroundColor: active ? c.accent : c.surface, borderWidth: 1, borderColor: active ? c.accent : c.border }}>
      {icon && <Icon name={icon} size={15} color={active ? c.accentText : c.textMuted} />}
      <Txt v="smallStrong" style={{ color: active ? c.accentText : c.textMuted }}>{label}</Txt>
      {count ? <Txt v="caption" style={{ color: active ? c.accentText : c.textFaint, fontFamily: font.mono }}>{count}</Txt> : null}
    </Pressy>
  );
}

export function EmptyState({ icon, title, body, action, onAction }: { icon: IconName; title: string; body?: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 36, paddingVertical: 48, gap: 10 }}>
      <View style={{ width: 76, height: 76, borderRadius: 26, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Icon name={icon} size={34} color={c.accentSoftText} />
      </View>
      <Txt v="h2" style={{ textAlign: 'center' }}>{title}</Txt>
      {body && <Txt tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>{body}</Txt>}
      {action && onAction && <View style={{ marginTop: 14, minWidth: 200 }}><Button title={action} onPress={onAction} full={false} /></View>}
    </View>
  );
}

export function Skeleton({ width, height = 14, round = 8, style }: { width?: number | `${number}%`; height?: number; round?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(v, { toValue: 0.45, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ width, height, borderRadius: round, backgroundColor: c.sunken, opacity: v }, style]} />;
}

export function ChatSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <View style={{ paddingHorizontal: 16, gap: 18, paddingTop: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Skeleton width={52} height={52} round={26} />
          <View style={{ flex: 1, gap: 9 }}><Skeleton width={`${40 + ((i * 17) % 30)}%`} height={14} /><Skeleton width={`${60 + ((i * 11) % 30)}%`} height={12} /></View>
        </View>
      ))}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.border, marginLeft: inset }} />;
}

export function SectionLabel({ children }: { children: string }) {
  return <Txt v="mono" tone="faint" style={{ textTransform: 'uppercase', marginTop: 26, marginBottom: 8, marginLeft: 4 }}>{children}</Txt>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, r } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: r(radius.lg), borderWidth: 1, borderColor: c.border, overflow: 'hidden' }, style]}>{children}</View>;
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressy onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} scale={0.94}
      style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: value ? c.accent : c.borderStrong, padding: 3, justifyContent: 'center' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: value ? c.accentText : '#fff', alignSelf: value ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }} />
    </Pressy>
  );
}

/** Three bouncing dots, used for "typing…". */
export function TypingDots({ color, size = 5 }: { color?: string; size?: number }) {
  const { c } = useTheme();
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = vals.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 140),
      Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(280 - i * 140),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vals]);
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.7, alignItems: 'center', height: size * 2 }} accessibilityLabel={tr('escribiendo')}>
      {vals.map((v, i) => <Animated.View key={i} style={{ width: size, height: size, borderRadius: size, backgroundColor: color ?? c.accent, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0.3, 1], outputRange: [0, -size * 0.7] }) }] }} />)}
    </View>
  );
}
