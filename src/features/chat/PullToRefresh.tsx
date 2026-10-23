import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Txt } from '../../ui';

const TRIGGER = 64;

/**
 * Drag down on the newest end of the (inverted) message list to reload the conversation. Works with touch on the
 * PWA too, where RefreshControl does nothing. `atEnd` must say whether the list is scrolled to the newest message.
 */
export function PullToRefresh({ atEnd, onRefresh, children }: { atEnd: React.MutableRefObject<boolean>; onRefresh: () => Promise<unknown>; children: React.ReactNode }) {
  const { c } = useTheme();
  const pull = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const busyRef = useRef(false);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => atEnd.current && !busyRef.current && g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 2,
    onMoveShouldSetPanResponderCapture: (_, g) => atEnd.current && !busyRef.current && g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 2,
    onPanResponderMove: (_, g) => { const d = Math.min(TRIGGER * 1.4, Math.max(0, g.dy) * 0.55); pull.setValue(d); setArmed(d >= TRIGGER); },
    onPanResponderRelease: async (_, g) => {
      const d = Math.max(0, g.dy) * 0.55;
      if (d >= TRIGGER) {
        busyRef.current = true; setBusy(true);
        Animated.spring(pull, { toValue: 44, useNativeDriver: false, speed: 20 }).start();
        try { await onRefresh(); } catch { /* the toast of the caller says it */ }
        busyRef.current = false; setBusy(false);
      }
      setArmed(false);
      Animated.spring(pull, { toValue: 0, useNativeDriver: false, speed: 18, bounciness: 6 }).start();
    },
    onPanResponderTerminate: () => { setArmed(false); Animated.spring(pull, { toValue: 0, useNativeDriver: false }).start(); },
  })).current;
  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, alignItems: 'center', justifyContent: 'center', height: pull, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          {busy ? <ActivityIndicator color={c.accent} size="small" /> : <Icon name={armed ? 'refresh-circle' : 'arrow-down-circle-outline'} size={18} tone={armed ? 'accent' : 'muted'} />}
          <Txt v="caption" tone={armed || busy ? 'accent' : 'muted'}>{busy ? 'Actualizando…' : armed ? 'Suelta para actualizar' : 'Arrastra para actualizar'}</Txt>
        </View>
      </Animated.View>
      <Animated.View style={{ flex: 1, transform: [{ translateY: Animated.multiply(pull, -1) }] }}>{children}</Animated.View>
    </View>
  );
}
