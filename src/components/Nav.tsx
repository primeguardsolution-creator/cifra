import { BlurView } from 'expo-blur';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChats } from '../state/ChatsProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Space } from '../theme/tokens';
import { Badge, Icon, IconName, Logo, Pressy, Txt } from '../ui';
import { BizSidebar, BizTabBar } from './BizNav';
import { SpaceSwitchRail } from './SpaceSwitch';

type Item = { href: string; label: string; icon: IconName; iconOn: IconName; badge?: 'chats' | 'inbox' | 'calls' };
export const navItems: Record<Space, Item[]> = {
  personal: [
    { href: '/chats', label: 'Chats', icon: 'chatbubbles-outline', iconOn: 'chatbubbles', badge: 'chats' },
    { href: '/updates', label: 'Estados', icon: 'aperture-outline', iconOn: 'aperture' },
    { href: '/calls', label: 'Llamadas', icon: 'call-outline', iconOn: 'call', badge: 'calls' },
    { href: '/contacts', label: 'Contactos', icon: 'people-outline', iconOn: 'people' },
    { href: '/settings', label: 'Ajustes', icon: 'settings-outline', iconOn: 'settings' },
  ],
  business: [
    { href: '/inbox', label: 'Bandeja', icon: 'file-tray-full-outline', iconOn: 'file-tray-full', badge: 'inbox' },
    { href: '/agenda', label: 'Agenda', icon: 'calendar-outline', iconOn: 'calendar' },
    { href: '/doer', label: 'Doer', icon: 'flash-outline', iconOn: 'flash' },
    { href: '/clients', label: 'Clientes', icon: 'people-outline', iconOn: 'people' },
    { href: '/more', label: 'Más', icon: 'grid-outline', iconOn: 'grid' },
  ],
};
export const topLevel = ['/chats', '/updates', '/calls', '/contacts', '/settings', '/inbox', '/catalog', '/business', '/agenda', '/clients', '/doer', '/more'];
/** Screens that live under the Business "Más" tab. */
export const moreRoutes = ['/more', '/catalog', '/business', '/settings'];

function useBadge(kind?: 'chats' | 'inbox' | 'calls') {
  const { unread, missedCalls } = useChats();
  return kind === 'chats' ? unread.personal : kind === 'inbox' ? unread.business : kind === 'calls' ? missedCalls : 0;
}

function TabItem({ item, active }: { item: Item; active: boolean }) {
  const { c } = useTheme();
  const badge = useBadge(item.badge);
  const pop = useRef(new Animated.Value(active ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const native = Platform.OS !== 'web';
  useEffect(() => {
    Animated.spring(pop, { toValue: active ? 1 : 0, useNativeDriver: native, speed: 16, bounciness: 10 }).start();
    if (active) Animated.sequence([
      Animated.timing(bounce, { toValue: 1, duration: 110, useNativeDriver: native }),
      Animated.spring(bounce, { toValue: 0, useNativeDriver: native, speed: 14, bounciness: 20 }),
    ]).start();
  }, [active, pop, bounce, native]);
  return (
    <Pressy onPress={() => router.replace(item.href as never)} haptic accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={item.label} scale={0.88} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 8 }}>
      <View style={{ width: 58, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: 58, height: 32, borderRadius: 16, backgroundColor: c.accentSoft, opacity: pop, transform: [{ scaleX: pop.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }] }} />
        <Animated.View style={{ transform: [{ scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }, { translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }}>
          <Icon name={active ? item.iconOn : item.icon} size={24} color={active ? c.accentSoftText : c.textMuted} />
        </Animated.View>
        {badge > 0 && <View style={{ position: 'absolute', top: -2, right: 2 }}><Badge count={badge} /></View>}
      </View>
      <Txt style={{ fontSize: 11, lineHeight: 14, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium', color: active ? c.text : c.textMuted }}>{item.label}</Txt>
    </Pressy>
  );
}

export function TabBar() {
  const { c, space, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  if (space === 'business') return <BizTabBar />; // (no hooks below depend on order: BizTabBar is its own component)
  // Personal: a floating glass pill, not a full-width bar.
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: 'transparent' }} pointerEvents="box-none">
      <BlurView intensity={Platform.OS === 'web' ? 70 : 50} tint={mode === 'dark' ? 'dark' : 'light'} style={{ borderRadius: 30, borderWidth: 1, borderColor: c.border, backgroundColor: c.glass, paddingHorizontal: 6, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOpacity: mode === 'dark' ? 0.5 : 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>
        {navItems[space].map((i) => <TabItem key={i.href} item={i} active={path === i.href} />)}
      </BlurView>
    </View>
  );
}

export function Rail() {
  const { c, space } = useTheme();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  if (space === 'business') return <BizSidebar />;
  const inChats = path.startsWith('/chat') || path === '/inbox' || path === '/assistant';
  return (
    <View style={{ width: 84, backgroundColor: c.rail, alignItems: 'center', paddingTop: insets.top + 18, paddingBottom: 16, gap: 18 }}>
      <Logo size={44} />
      <SpaceSwitchRail />
      <View style={{ flex: 1, gap: 6, marginTop: 6 }}>
        {navItems[space].map((item) => <RailItem key={item.href} item={item} active={path === item.href || (inChats && (item.href === '/chats' || item.href === '/inbox'))} />)}
      </View>
    </View>
  );
}

function RailItem({ item, active }: { item: Item; active: boolean }) {
  const { c } = useTheme();
  const badge = useBadge(item.badge);
  return (
    <Pressy onPress={() => router.replace(item.href as never)} haptic accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={item.label} scale={0.9}
      style={{ width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent' }}>
      <Icon name={active ? item.iconOn : item.icon} size={24} color={active ? '#fff' : c.railText} />
      <Txt style={{ fontSize: 10, lineHeight: 12, fontFamily: 'Inter_500Medium', color: active ? '#fff' : c.railText }}>{item.label}</Txt>
      {badge > 0 && <View style={{ position: 'absolute', top: 3, right: 3 }}><Badge count={badge} /></View>}
    </Pressy>
  );
}
