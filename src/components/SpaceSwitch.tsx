import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, View } from 'react-native';
import { setSpaceTransitionOrigin, useReducedMotion } from '../lib/motion';
import { useChats } from '../state/ChatsProvider';
import { useSpace } from '../state/SpaceProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Space } from '../theme/tokens';
import { Glass, Icon, IconName, Pressy, Txt } from '../ui';
import { t, tr } from '../i18n';

const options: { key: Space; label: string; icon: IconName }[] = [
  { key: 'personal', label: 'Personal', icon: 'person' },
  { key: 'business', label: 'Business', icon: 'storefront' },
];

/** The one-tap switch between the Personal and Business spaces. */
export function SpaceSwitch() {
  const { c, space } = useTheme();
  const reducedMotion = useReducedMotion();
  const { switchSpace } = useSpace();
  const [pendingSpace, setPendingSpace] = useState<Space | null>(null);
  const shownSpace = pendingSpace ?? space;
  const { unread } = useChats();
  const [w, setW] = useState(0);
  const switchRef = useRef<View>(null);
  const x = useRef(new Animated.Value(space === 'personal' ? 0 : 1)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const previousSpace = useRef(shownSpace);
  useEffect(() => {
    if (previousSpace.current === shownSpace) return;
    previousSpace.current = shownSpace;
    if (reducedMotion) { x.setValue(shownSpace === 'personal' ? 0 : 1); stretch.setValue(1); return; }
    Animated.parallel([
      Animated.spring(x, { toValue: shownSpace === 'personal' ? 0 : 1, useNativeDriver: Platform.OS !== 'web', damping: 19, stiffness: 190, mass: 0.82 }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1.055, duration: 130, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(stretch, { toValue: 1, useNativeDriver: Platform.OS !== 'web', damping: 17, stiffness: 230, mass: 0.7 }),
      ]),
    ]).start();
  }, [shownSpace, x, stretch, reducedMotion]);
  const seg = w > 0 ? (w - 8) / 2 : 0;
  useEffect(() => {
    if (pendingSpace && pendingSpace === space) setPendingSpace(null);
  }, [space, pendingSpace]);
  const selectSpace = (next: Space) => {
    if (next === space || next === pendingSpace) { switchSpace(next); return; }
    setPendingSpace(next);
    const node = switchRef.current;
    if (!node?.measureInWindow) { switchSpace(next); return; }
    node.measureInWindow((x, y, width, height) => {
      const segmentWidth = Math.max(0, ((width || w) - 8) / 2);
      const segmentCenter = x + 4 + segmentWidth * (next === 'business' ? 1.5 : 0.5);
      setSpaceTransitionOrigin(segmentCenter, y + (height || 46) / 2, segmentWidth, 38);
      switchSpace(next);
    });
  };

  return (
    <View ref={switchRef} collapsable={false} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist" style={{ height: 46, borderRadius: 16, padding: 4, flexDirection: 'row' }}>
      <Glass radius={16} style={{ position: 'absolute', inset: 0 } as object} />
      {seg > 0 && (
        <Animated.View style={{ position: 'absolute', left: 4, top: 4, width: seg, height: 38, borderRadius: 12, backgroundColor: c.accent, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, seg] }) }, { scaleX: stretch }], shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }} />
      )}
      {options.map((o) => {
        const active = o.key === shownSpace;
        const other = !active ? (o.key === 'business' ? unread.business : unread.personal) : 0;
        return (
          <Pressy key={o.key} onPress={() => selectSpace(o.key)} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t('Espacio {name}', { name: tr(o.label) })} scale={0.97}
            style={{ flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Icon name={o.icon} size={16} color={active ? c.accentText : c.textMuted} />
            <Txt v="smallStrong" style={{ color: active ? c.accentText : c.textMuted }}>{o.label}</Txt>
            {other > 0 && <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.highlight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Txt style={{ color: '#fff', fontSize: 11, lineHeight: 14, fontFamily: 'Inter_700Bold' }}>{other > 9 ? '9+' : other}</Txt></View>}
          </Pressy>
        );
      })}
    </View>
  );
}

/** Compact vertical variant for the desktop rail. */
export function SpaceSwitchRail() {
  const { c, space } = useTheme();
  const { switchSpace } = useSpace();
  const { unread } = useChats();
  const railRef = useRef<View>(null);
  const selectRailSpace = (next: Space) => {
    if (next === space) { switchSpace(next); return; }
    const node = railRef.current;
    if (!node?.measureInWindow) { switchSpace(next); return; }
    node.measureInWindow((x, y) => {
      setSpaceTransitionOrigin(x + 28, y + (next === 'business' ? 82 : 28), 48, 48);
      switchSpace(next);
    });
  };
  return (
    <View ref={railRef} collapsable={false} style={{ gap: 6, padding: 4, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)' }}>
      {options.map((o) => {
        const active = o.key === space;
        const other = !active ? (o.key === 'business' ? unread.business : unread.personal) : 0;
        return (
          <Pressy key={o.key} onPress={() => selectRailSpace(o.key)} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t('Espacio {name}', { name: tr(o.label) })} scale={0.92}
            style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.accent : 'transparent' }}>
            <Icon name={o.icon} size={22} color={active ? c.accentText : c.railText} />
            {other > 0 && <View style={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: c.highlight }} />}
          </Pressy>
        );
      })}
    </View>
  );
}
