import { useRef, useState } from 'react';
import { Animated, Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { hapticTap } from '../lib/haptics';
import { tr } from '../i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a soft spring-scale response. Works with mouse, touch and keyboard. The style lands on the pressable itself, so flex/size props behave. */
export function Pressy({ children, style, scale = 0.97, hoverStyle, haptic, ...props }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scale?: number; hoverStyle?: ViewStyle; haptic?: boolean }) {
  const v = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);
  const to = (value: number) => Animated.spring(v, { toValue: value, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 4 }).start();
  return (
    <AnimatedPressable
      {...props}
      accessibilityLabel={props.accessibilityLabel ? tr(props.accessibilityLabel) : undefined}
      onPressIn={(e) => { to(scale); if (haptic) hapticTap(); props.onPressIn?.(e); }}
      onPressOut={(e) => { to(1); props.onPressOut?.(e); }}
      onHoverIn={(e) => { if (hoverStyle) setHovered(true); props.onHoverIn?.(e); }}
      onHoverOut={(e) => { setHovered(false); props.onHoverOut?.(e); }}
      style={[style, hovered && hoverStyle, { transform: [{ scale: v }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
