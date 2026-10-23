import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, View } from 'react-native';
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
  const { switchSpace } = useSpace();
  const { unread } = useChats();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(space === 'personal' ? 0 : 1)).current;
  useEffect(() => { Animated.spring(x, { toValue: space === 'personal' ? 0 : 1, useNativeDriver: Platform.OS !== 'web', speed: 16, bounciness: 6 }).start(); }, [space, x]);
  const seg = w > 0 ? (w - 8) / 2 : 0;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist" style={{ height: 46, borderRadius: 16, padding: 4, flexDirection: 'row' }}>
      <Glass radius={16} style={{ position: 'absolute', inset: 0 } as object} />
      {seg > 0 && (
        <Animated.View style={{ position: 'absolute', left: 4, top: 4, width: seg, height: 38, borderRadius: 12, backgroundColor: c.accent, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, seg] }) }], shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }} />
      )}
      {options.map((o) => {
        const active = o.key === space;
        const other = !active ? (o.key === 'business' ? unread.business : unread.personal) : 0;
        return (
          <Pressy key={o.key} onPress={() => switchSpace(o.key)} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t('Espacio {name}', { name: tr(o.label) })} scale={0.97}
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
  return (
    <View style={{ gap: 6, padding: 4, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)' }}>
      {options.map((o) => {
        const active = o.key === space;
        const other = !active ? (o.key === 'business' ? unread.business : unread.personal) : 0;
        return (
          <Pressy key={o.key} onPress={() => switchSpace(o.key)} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t('Espacio {name}', { name: tr(o.label) })} scale={0.92}
            style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.accent : 'transparent' }}>
            <Icon name={o.icon} size={22} color={active ? c.accentText : c.railText} />
            {other > 0 && <View style={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: c.highlight }} />}
          </Pressy>
        );
      })}
    </View>
  );
}
