import { useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { takeSharedAvatar, useReducedMotion } from '../../lib/motion';

/** Wraps the chat-header avatar: when the chat was opened from an inbox row, the avatar glides from where that row's avatar was to its place (a short shared-element transition). */
export function FlyAvatar({ conv, children }: { conv: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<View>(null);
  const done = useRef(false);
  const t = useRef(new Animated.Value(1)).current;
  const [from, setFrom] = useState({ dx: 0, dy: 0, s: 1 });
  const onLayout = () => {
    if (done.current || reduced) return;
    done.current = true;
    const src = takeSharedAvatar(conv);
    if (!src) return;
    ref.current?.measureInWindow?.((x, y, w) => {
      if (!w) return;
      setFrom({ dx: src.x - x, dy: src.y - y, s: src.size / w });
      t.setValue(0);
      Animated.timing(t, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    });
  };
  return (
    <Animated.View ref={ref as never} collapsable={false} onLayout={onLayout} style={{ zIndex: 20, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from.dx, 0] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from.dy, 0] }) }, { scale: t.interpolate({ inputRange: [0, 1], outputRange: [from.s, 1] }) }] }}>
      {children}
    </Animated.View>
  );
}
