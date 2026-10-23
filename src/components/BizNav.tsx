import { router, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../state/AuthProvider';
import { useChats } from '../state/ChatsProvider';
import { useSpace } from '../state/SpaceProvider';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';
import { Avatar, Badge, Icon, IconName, Logo, Pressy, Txt } from '../ui';

// Business navigation is deliberately a different species from Personal: flat bar with a signal stripe, a raised "Doer" key,
// and (on wide screens) a workspace sidebar with labelled sections, like a team tool.
type BizItem = { href: string; label: string; icon: IconName; iconOn: IconName; badge?: 'inbox' };
const items: BizItem[] = [
  { href: '/inbox', label: 'Bandeja', icon: 'file-tray-full-outline', iconOn: 'file-tray-full', badge: 'inbox' },
  { href: '/agenda', label: 'Agenda', icon: 'calendar-outline', iconOn: 'calendar' },
  { href: '/doer', label: 'Doer', icon: 'flash-outline', iconOn: 'flash' },
  { href: '/clients', label: 'Clientes', icon: 'people-outline', iconOn: 'people' },
  { href: '/more', label: 'Más', icon: 'grid-outline', iconOn: 'grid' },
];
const moreRoutes = ['/more', '/catalog', '/business', '/settings'];
const isActive = (href: string, path: string) => (href === '/more' ? moreRoutes.includes(path) : href === '/inbox' ? path === '/inbox' || path.startsWith('/chat/') : path === href);

function useInbox() { return useChats().unread.business; }

export function BizTabBar() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const unread = useInbox();
  return (
    <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 4), flexDirection: 'row', alignItems: 'flex-end' }}>
      {items.map((it) => {
        const on = isActive(it.href, path);
        if (it.href === '/doer') {
          return (
            <View key={it.href} style={{ flex: 1, alignItems: 'center' }}>
              <Pressy onPress={() => router.replace('/doer')} haptic accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel="Doer, tu asistente que hace las tareas" scale={0.9}
                style={{ marginTop: -16, width: 56, height: 56, borderRadius: 14, backgroundColor: c.highlight, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.surface, shadowColor: c.highlight, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}>
                <Icon name="flash" size={26} color="#16160F" />
              </Pressy>
              <Txt style={{ fontSize: 10, lineHeight: 12, fontFamily: font.mono, letterSpacing: 0.5, color: on ? c.text : c.textMuted, textTransform: 'uppercase', marginBottom: 6, marginTop: 2 }}>Doer</Txt>
            </View>
          );
        }
        return (
          <Pressy key={it.href} onPress={() => router.replace(it.href as never)} haptic accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={it.label} scale={0.92} style={{ flex: 1, alignItems: 'center', gap: 3, paddingTop: 11, paddingBottom: 6 }}>
            <View style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 3, backgroundColor: on ? c.highlight : 'transparent' }} />
            <View>
              <Icon name={on ? it.iconOn : it.icon} size={23} color={on ? c.text : c.textMuted} />
              {it.badge && unread > 0 && <View style={{ position: 'absolute', top: -6, right: -12 }}><Badge count={unread} /></View>}
            </View>
            <Txt style={{ fontSize: 10, lineHeight: 12, fontFamily: font.mono, letterSpacing: 0.5, color: on ? c.text : c.textMuted, textTransform: 'uppercase' }}>{it.label}</Txt>
          </Pressy>
        );
      })}
    </View>
  );
}

function SideRow({ icon, label, href, count, on }: { icon: IconName; label: string; href: string; count?: number; on: boolean }) {
  const { c } = useTheme();
  return (
    <Pressy onPress={() => router.replace(href as never)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} scale={0.99} hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 11, height: 38, paddingHorizontal: 12, borderRadius: 7, backgroundColor: on ? c.highlight : 'transparent' }}>
      <Icon name={icon} size={18} color={on ? '#16160F' : c.railText} />
      <Txt v="smallStrong" style={{ flex: 1, color: on ? '#16160F' : '#EDE6D3' }}>{label}</Txt>
      {count ? <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: on ? '#16160F' : c.highlight, alignItems: 'center', justifyContent: 'center' }}><Txt style={{ fontSize: 11, lineHeight: 14, fontFamily: font.bold, color: on ? c.highlight : '#16160F' }}>{count}</Txt></View> : null}
    </Pressy>
  );
}

export function BizSidebar() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const unread = useInbox();
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
        <SideRow icon="calendar" label="Agenda" href="/agenda" on={path === '/agenda'} />
        <SideRow icon="people" label="Clientes" href="/clients" on={path === '/clients'} />
        <SideRow icon="flash" label="Doer" href="/doer" on={path === '/doer'} />
      </View>
      {label('NEGOCIO')}
      <View style={{ gap: 2 }}>
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
