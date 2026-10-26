import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../state/AuthProvider';
import { useAttention } from '../state/AttentionProvider';
import { useChats } from '../state/ChatsProvider';
import { useSpace } from '../state/SpaceProvider';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';
import { Avatar, Badge, Icon, IconName, Logo, Pressy, Txt } from '../ui';

// Business navigation is deliberately a different species from Personal: flat bar with a signal stripe, a raised "Doer" key,
// and (on wide screens) a workspace sidebar with labelled sections, like a team tool. Icons move too: the stripe slides in,
// the active icon bounces, the Doer key breathes and sidebar icons pop when they light up.
type BizItem = { href: string; label: string; icon: IconName; iconOn: IconName; badge?: 'inbox' | 'agenda' };
const items: BizItem[] = [
  { href: '/inbox', label: 'Bandeja', icon: 'file-tray-full-outline', iconOn: 'file-tray-full', badge: 'inbox' },
  { href: '/agenda', label: 'Agenda', icon: 'calendar-outline', iconOn: 'calendar', badge: 'agenda' },
  { href: '/doer', label: 'Doer', icon: 'flash-outline', iconOn: 'flash' },
  { href: '/clients', label: 'Clientes', icon: 'people-outline', iconOn: 'people' },
  { href: '/more', label: 'Más', icon: 'grid-outline', iconOn: 'grid' },
];
const moreRoutes = ['/more', '/catalog', '/business', '/settings', '/posts'];
const isActive = (href: string, path: string) => (href === '/more' ? moreRoutes.includes(path) : href === '/inbox' ? path === '/inbox' || path.startsWith('/chat/') : path === href);
const native = Platform.OS !== 'web';

function useInbox() { return useChats().unread.business; }
function useAgendaBubble() { return useAttention().requests; }

/** Spring that lands on 1 when `on`, 0 otherwise, plus a one-shot bounce each time it turns on. */
function useLight(on: boolean) {
  const light = useRef(new Animated.Value(on ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(light, { toValue: on ? 1 : 0, useNativeDriver: native, speed: 18, bounciness: 8 }).start();
    if (on) Animated.sequence([
      Animated.timing(bounce, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.spring(bounce, { toValue: 0, useNativeDriver: native, speed: 14, bounciness: 18 }),
    ]).start();
  }, [on, light, bounce]);
  return { light, bounce };
}

function BizTab({ it, on, unread }: { it: BizItem; on: boolean; unread: number }) {
  const { c } = useTheme();
  const requests = useAgendaBubble();
  const count = it.badge === 'agenda' ? requests : unread;
  const { light, bounce } = useLight(on);
  return (
    <Pressy onPress={() => router.replace(it.href as never)} haptic accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={it.label} scale={0.92} style={{ flex: 1, alignItems: 'center', gap: 3, paddingTop: 11, paddingBottom: 6 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 3, backgroundColor: c.highlight, opacity: light, transform: [{ scaleX: light.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }} />
      <Animated.View style={{ transform: [{ scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }, { translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }, { rotate: bounce.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] }) }] }}>
        <Icon name={on ? it.iconOn : it.icon} size={23} color={on ? c.text : c.textMuted} />
        {it.badge && count > 0 && <View style={{ position: 'absolute', top: -6, right: -12 }}><Badge count={count} /></View>}
      </Animated.View>
      <Txt style={{ fontSize: 10, lineHeight: 12, fontFamily: font.mono, letterSpacing: 0.5, color: on ? c.text : c.textMuted, textTransform: 'uppercase' }}>{it.label}</Txt>
    </Pressy>
  );
}

/** The raised Doer key breathes slowly (glow + scale) and jolts when pressed. */
function DoerKey({ on }: { on: boolean }) {
  const { c } = useTheme();
  const breath = useRef(new Animated.Value(0)).current;
  const jolt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(breath, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breath]);
  const press = () => {
    Animated.sequence([
      Animated.timing(jolt, { toValue: 1, duration: 90, useNativeDriver: native }),
      Animated.timing(jolt, { toValue: -1, duration: 110, useNativeDriver: native }),
      Animated.spring(jolt, { toValue: 0, useNativeDriver: native, speed: 24, bounciness: 16 }),
    ]).start();
    router.replace('/doer');
  };
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressy onPress={press} haptic accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel="Doer, tu asistente que hace las tareas" scale={0.9} style={{ marginTop: -16 }}>
        <Animated.View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: c.highlight, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.surface, shadowColor: c.highlight, shadowOpacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }), shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, on ? 1.06 : 1.03] }) }, { rotate: jolt.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] }) }] }}>
          <Icon name="flash" size={26} color={c.highlightText} />
        </Animated.View>
      </Pressy>
      <Txt style={{ fontSize: 10, lineHeight: 12, fontFamily: font.mono, letterSpacing: 0.5, color: on ? c.text : c.textMuted, textTransform: 'uppercase', marginBottom: 6, marginTop: 2 }}>Doer</Txt>
    </View>
  );
}

export function BizTabBar() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const unread = useInbox();
  return (
    <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 4), flexDirection: 'row', alignItems: 'flex-end' }}>
      {items.map((it) => (it.href === '/doer' ? <DoerKey key={it.href} on={isActive(it.href, path)} /> : <BizTab key={it.href} it={it} on={isActive(it.href, path)} unread={unread} />))}
    </View>
  );
}

function SideRow({ icon, label, href, count, on }: { icon: IconName; label: string; href: string; count?: number; on: boolean }) {
  const { c } = useTheme();
  const { light, bounce } = useLight(on);
  return (
    <Pressy onPress={() => router.replace(href as never)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} scale={0.99} hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 11, height: 38, paddingHorizontal: 12, borderRadius: 7, overflow: 'hidden' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: c.highlight, opacity: light, transform: [{ translateX: light.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] } as object} />
      <Animated.View style={{ transform: [{ scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }, { rotate: bounce.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] }) }] }}>
        <Icon name={icon} size={18} color={on ? c.highlightText : c.railText} />
      </Animated.View>
      <Txt v="smallStrong" style={{ flex: 1, color: on ? c.highlightText : '#EDE6D3' }}>{label}</Txt>
      {count ? <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: on ? c.highlightText : c.highlight, alignItems: 'center', justifyContent: 'center' }}><Txt style={{ fontSize: 11, lineHeight: 14, fontFamily: font.bold, color: on ? c.highlight : c.highlightText }}>{count}</Txt></View> : null}
    </Pressy>
  );
}

export function BizSidebar() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const unread = useInbox();
  const requests = useAgendaBubble();
  const { active, switchSpace } = useSpace();
  const { profile, user } = useAuth();
  const label = (t: string) => <Txt v="mono" style={{ color: '#8F8666', marginTop: 18, marginBottom: 6, marginLeft: 12 }}>{t}</Txt>;
  return (
    <View style={{ width: 248, backgroundColor: c.rail, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.07)', paddingTop: insets.top + 14, paddingBottom: 14, paddingHorizontal: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingBottom: 12 }}>
        <Logo size={34} />
        <View style={{ flex: 1 }}>
          <Txt v="smallStrong" numberOfLines={1} style={{ color: '#fff', fontFamily: font.display, fontSize: 16 }}>{active?.business.name ?? 'Business'}</Txt>
          <Txt v="mono" style={{ color: '#8F8666' }}>ESPACIO DE TRABAJO</Txt>
        </View>
        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.highlight }} accessibilityLabel="Color del negocio" />
      </View>
      <Pressy onPress={() => switchSpace('personal')} accessibilityRole="button" accessibilityLabel="Cambiar al espacio Personal" scale={0.98} hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 40, paddingHorizontal: 12, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
        <Icon name="swap-horizontal" size={17} color={c.highlight} />
        <Txt v="smallStrong" style={{ flex: 1, color: '#EDE6D3' }}>Ir a Personal</Txt>
        <Icon name="person" size={16} color={c.railText} />
      </Pressy>
      {label('TRABAJO')}
      <View style={{ gap: 2 }}>
        <SideRow icon="file-tray-full" label="Bandeja" href="/inbox" count={unread} on={isActive('/inbox', path)} />
        <SideRow icon="calendar" label="Agenda" href="/agenda" count={requests} on={path === '/agenda'} />
        <SideRow icon="people" label="Clientes" href="/clients" on={path === '/clients'} />
        <SideRow icon="flash" label="Doer" href="/doer" on={path === '/doer'} />
      </View>
      {label('NEGOCIO')}
      <View style={{ gap: 2 }}>
        <SideRow icon="aperture" label="Publicaciones" href="/posts" on={path === '/posts'} />
        <SideRow icon="pricetags" label="Catálogo" href="/catalog" on={path === '/catalog'} />
        <SideRow icon="storefront" label="Perfil y equipo" href="/business" on={path === '/business'} />
        <SideRow icon="settings" label="Ajustes" href="/settings" on={path === '/settings'} />
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <Avatar name={profile?.display_name} seed={user?.id} path={profile?.avatar_path} size={34} />
        <View style={{ flex: 1 }}><Txt v="smallStrong" numberOfLines={1} style={{ color: '#EDE6D3' }}>{profile?.display_name ?? '…'}</Txt><Txt v="caption" style={{ color: '#8F8666' }}>{active?.role === 'owner' ? 'Propietario' : active?.role ?? ''}</Txt></View>
      </View>
    </View>
  );
}
