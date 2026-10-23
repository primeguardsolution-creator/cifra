import { useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Icon, IconName } from './Icon';
import { Pressy } from './Pressy';
import { Txt } from './Txt';

type Props = {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
  icon?: IconName; loading?: boolean; disabled?: boolean; size?: 'md' | 'lg' | 'sm'; style?: StyleProp<ViewStyle>; full?: boolean; iconRight?: IconName;
};

export function Button({ title, onPress, variant = 'primary', icon, iconRight, loading, disabled, size = 'md', style, full = true }: Props) {
  const { c, r } = useTheme();
  const h = size === 'lg' ? 56 : size === 'sm' ? 38 : 48;
  const palette = {
    primary: { bg: c.accent, fg: c.accentText, border: 'transparent' },
    secondary: { bg: c.surface, fg: c.text, border: c.borderStrong },
    soft: { bg: c.accentSoft, fg: c.accentSoftText, border: 'transparent' },
    ghost: { bg: 'transparent', fg: c.accent, border: 'transparent' },
    danger: { bg: c.dangerSoft, fg: c.danger, border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressy
      accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }} accessibilityLabel={title}
      disabled={off} onPress={onPress}
      style={[{ height: h, borderRadius: r(size === 'lg' ? 18 : radius.md), backgroundColor: palette.bg, borderWidth: palette.border === 'transparent' ? 0 : 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: size === 'sm' ? 14 : 20, opacity: off && !loading ? 0.5 : 1, alignSelf: full ? 'stretch' : 'flex-start' }, variant === 'primary' && { shadowColor: c.accent, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }, style]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} color={palette.fg} />}
          <Txt v={size === 'sm' ? 'smallStrong' : 'bodyStrong'} style={{ color: palette.fg }}>{title}</Txt>
          {iconRight && <Icon name={iconRight} size={19} color={palette.fg} />}
        </>
      )}
    </Pressy>
  );
}

export function IconButton({ icon, onPress, label, tone = 'text', size = 40, filled, badge, wiggle, pop, haptic = true, disabled }: { icon: IconName; onPress?: () => void; label: string; tone?: 'text' | 'muted' | 'accent' | 'onAccent' | 'danger'; size?: number; filled?: boolean; badge?: boolean; wiggle?: boolean; pop?: boolean; haptic?: boolean; disabled?: boolean }) {
  const { c } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const native = Platform.OS !== 'web';
  const play = () => {
    if (wiggle) Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(anim, { toValue: -1, duration: 110, useNativeDriver: native }),
      Animated.timing(anim, { toValue: 0.6, duration: 90, useNativeDriver: native }),
      Animated.spring(anim, { toValue: 0, useNativeDriver: native, speed: 30, bounciness: 14 }),
    ]).start();
    else if (pop) Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 90, useNativeDriver: native }),
      Animated.spring(anim, { toValue: 0, useNativeDriver: native, speed: 22, bounciness: 18 }),
    ]).start();
  };
  return (
    <Pressy accessibilityRole="button" accessibilityLabel={label} disabled={disabled} haptic={haptic} onPress={() => { play(); onPress?.(); }} scale={0.82} hoverStyle={{ backgroundColor: c.surfaceAlt }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? c.accent : 'transparent', opacity: disabled ? 0.4 : 1 }}>
      <Animated.View style={{ transform: [wiggle ? { rotate: anim.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] }) } : { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }}>
        <Icon name={icon} size={size * 0.52} tone={filled ? 'onAccent' : tone} />
      </Animated.View>
      {badge && <View style={{ position: 'absolute', top: size * 0.18, right: size * 0.2, width: 9, height: 9, borderRadius: 5, backgroundColor: c.highlight, borderWidth: 2, borderColor: c.bg }} />}
    </Pressy>
  );
}
