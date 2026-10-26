import { router, usePathname } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chat } from '../lib/api';
import { useAuth } from '../state/AuthProvider';
import { useChats } from '../state/ChatsProvider';
import { useSpace } from '../state/SpaceProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Chip, ChatSkeleton, EmptyState, Field, Icon, IconButton, IconName, Pressy, Sheet, SheetRow, Txt, useToast } from '../ui';
import { friendly } from '../lib/errors';
import { listAppointments, listRequestedAppointments, startOfDay, addDays } from '../lib/biz';
import { useEffect } from 'react';
import { setChatFlags } from '../lib/api';
import { ChatRow, chatTitle, previewText } from './ChatRow';
import { SpaceSwitch } from './SpaceSwitch';
import { AssistantRow, assistantMatches } from '../features/assistant/AssistantRow';
import { useAssistantState } from '../features/assistant/store';
import { InvitationsBanner } from '../features/agenda/Invitations';
import { appUrl, inviteMessage, shareText } from '../lib/share';
import { t, tr } from '../i18n';

type Filter = 'all' | 'unread' | 'groups' | 'mine' | 'unassigned' | 'open' | 'pending' | 'resolved' | 'archived';

export function ChatsPane({ embedded }: { embedded?: boolean }) {
  const { c, space, r } = useTheme();
  const { user } = useAuth();
  const { chats, loading, error, refresh, patch } = useChats();
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<Chat | null>(null);
  const { active, businesses, loaded, setActiveBusiness } = useSpace();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const selectedId = path.startsWith('/chat/') ? path.split('/')[2] : undefined;
  const business = space === 'business';
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [today, setToday] = useState<{ appts: number; requests: number }>({ appts: 0, requests: 0 });
  const bizId = active?.business.id;
  useEffect(() => {
    if (!business || !bizId) return;
    let live = true;
    Promise.all([listAppointments(bizId, startOfDay(new Date()), addDays(startOfDay(new Date()), 1)), listRequestedAppointments(bizId)])
      .then(([a, rq]) => live && setToday({ appts: a.filter((x) => x.status !== 'cancelled').length, requests: rq.length })).catch(() => {});
    return () => { live = false; };
  }, [business, bizId, chats.length]);
  const bot = useAssistantState();

  const filters: { key: Filter; label: string }[] = business
    ? [{ key: 'all', label: 'Todos' }, { key: 'unread', label: 'No leídos' }, { key: 'mine', label: 'Míos' }, { key: 'unassigned', label: 'Sin asignar' }, { key: 'open', label: 'Abiertos' }, { key: 'pending', label: 'Pendientes' }, { key: 'resolved', label: 'Resueltos' }]
    : [{ key: 'all', label: 'Todos' }, { key: 'unread', label: 'No leídos' }, { key: 'groups', label: 'Grupos' }, ...(chats.some((x) => x.archived) ? [{ key: 'archived' as Filter, label: 'Archivados' }] : [])];

  const counts = useMemo(() => ({
    open: chats.filter((x) => x.state === 'open').length,
    pending: chats.filter((x) => x.state === 'pending').length,
    unassigned: chats.filter((x) => !x.assigned_to && x.state !== 'resolved' && x.state !== 'closed').length,
  }), [chats]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return chats.filter((x: Chat) => {
      if (!business && filter === 'archived' ? !x.archived : !business && x.archived) return false;
      if (filter === 'unread' && x.unread === 0 && !x.marked_unread) return false;
      if (filter === 'groups' && x.kind !== 'group') return false;
      if (filter === 'mine' && x.assigned_to !== user?.id) return false;
      if (filter === 'unassigned' && x.assigned_to) return false;
      if ((filter === 'open' || filter === 'pending' || filter === 'resolved') && x.state !== filter) return false;
      if (!needle) return true;
      return chatTitle(x).toLowerCase().includes(needle) || (x.peer_phone ?? '').includes(needle) || previewText(x, user?.id).toLowerCase().includes(needle);
    });
  }, [chats, q, filter, user?.id]);

  const invite = async () => toast.show((await shareText(inviteMessage, appUrl())) === 'copied' ? 'Invitación copiada' : 'Invitación enviada', 'success');
  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const header = (
    <View style={{ paddingTop: embedded ? insets.top + 14 : insets.top + 10, paddingHorizontal: 16, gap: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        {business ? (
          <Pressy onPress={() => setSwitcher(true)} accessibilityRole="button" accessibilityLabel="Cambiar de negocio" scale={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Txt v="h1" numberOfLines={1} style={{ flexShrink: 1 }}>{active?.business.name ?? 'Bandeja'}</Txt>
            {businesses.length > 0 && <Icon name="chevron-down" size={20} tone="muted" />}
          </Pressy>
        ) : <Txt v="h1">Chats</Txt>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconButton icon="search" label="Buscar en todos los mensajes" pop onPress={() => router.push('/search')} />
          {!business && <IconButton icon="person-add-outline" label="Invitar a alguien a CIFRA" pop onPress={invite} />}
          {!business && <IconButton icon="create-outline" label="Nuevo chat" wiggle onPress={() => router.push('/new-chat')} filled />}
          {business && active && <IconButton icon="share-social" label="Perfil público y enlace para clientes" pop onPress={() => router.push({ pathname: '/b/[id]', params: { id: active.business.id } })} filled />}
        </View>
      </View>
      {!(business && embedded) && <SpaceSwitch />}
      {business && active && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { n: today.appts, l: 'Citas hoy', icon: 'calendar' as const, go: '/agenda', hot: today.requests > 0 },
            { n: counts.unassigned, l: 'Sin asignar', icon: 'person-add' as const, go: null as string | null, hot: counts.unassigned > 0 },
            { n: counts.open, l: 'Abiertos', icon: 'chatbubble-ellipses' as const, go: null as string | null, hot: false },
          ].map((s2) => (
            <Pressy key={s2.l} onPress={() => (s2.go ? router.push(s2.go as never) : setFilter(s2.l === 'Abiertos' ? 'open' : 'unassigned'))} accessibilityRole="button" accessibilityLabel={`${s2.l}: ${s2.n}`} scale={0.97}
              style={{ flex: 1, backgroundColor: c.surface, borderRadius: r(10), borderWidth: 1, borderColor: s2.hot ? c.highlight : c.border, borderLeftWidth: 4, borderLeftColor: s2.hot ? c.highlight : c.borderStrong, paddingVertical: 8, paddingHorizontal: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name={s2.icon} size={12} color={c.highlight} /><Txt v="mono" tone="faint" numberOfLines={1} style={{ fontSize: 9, flexShrink: 1 }}>{s2.l.toUpperCase()}</Txt></View>
              <Txt v="h2">{s2.n}</Txt>
            </Pressy>
          ))}
        </View>
      )}
      {business && active && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel="Accesos rápidos del negocio">
          {([
            { icon: 'aperture', label: 'Publicar estado', go: '/posts', hot: true },
            { icon: 'megaphone', label: 'Difusión', go: '/broadcast' },
            { icon: 'pricetags', label: 'Catálogo', go: '/catalog' },
            { icon: 'eye', label: 'Mi página', go: `/b/${active.business.id}` },
            { icon: 'share-social', label: 'Compartir negocio', go: '' },
            { icon: 'storefront', label: 'Perfil y equipo', go: '/business' },
          ] as { icon: IconName; label: string; go: string; hot?: boolean }[]).map((a) => (
            <Pressy key={a.label} accessibilityRole="button" accessibilityLabel={tr(a.label)} scale={0.96}
              onPress={async () => { if (a.go) router.push(a.go as never); else toast.show((await shareText(t('Escribe a {name} por CIFRA', { name: active.business.name }), `${appUrl()}/b/${active.business.handle ?? active.business.id}`)) === 'copied' ? 'Enlace copiado' : 'Enlace compartido', 'success'); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 12, borderRadius: r(8), backgroundColor: a.hot ? c.highlight : c.surface, borderWidth: 1, borderColor: a.hot ? c.highlight : c.border }}>
              <Icon name={a.icon} size={16} color={a.hot ? c.highlightText : c.highlight} />
              <Txt v="smallStrong" style={a.hot ? { color: c.highlightText } : undefined}>{a.label}</Txt>
            </Pressy>
          ))}
        </ScrollView>
      )}
      {!(business && loaded && !active) && <><Field value={q} onChangeText={setQ} placeholder={business ? 'Buscar clientes o mensajes' : 'Buscar en tus chats'} icon="search" autoCapitalize="none" style={{ paddingVertical: 10 }} right={q ? <IconButton icon="close-circle" label="Borrar búsqueda" onPress={() => setQ('')} tone="muted" size={30} /> : undefined} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
        {filters.map((f) => <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </ScrollView></>}
    </View>
  );
  const atQuery = q.trim().startsWith('@') && q.trim().length > 2 ? q.trim().slice(1) : null;
  const botRow = !business && assistantMatches(q, filter, bot.loaded && !bot.seen) ? <AssistantRow /> : null;
  const atRow = !business && atQuery ? (
    <Pressy onPress={() => router.push({ pathname: '/new-chat', params: { q: atQuery } })} accessibilityRole="button" accessibilityLabel={t('Buscar @{q} en CIFRA', { q: atQuery })} scale={0.985} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="at" size={24} color={c.accentSoftText} /></View>
      <View style={{ flex: 1 }}><Txt v="bodyStrong">Buscar @{atQuery} en CIFRA</Txt><Txt v="small" tone="muted">Personas y negocios, aunque no estén en tus chats</Txt></View>
      <Icon name="chevron-forward" size={18} tone="faint" />
    </Pressy>
  ) : null;

  let body: React.ReactNode;
  if (business && loaded && !active) {
    body = <BusinessOnboarding />;
  } else if (loading && chats.length === 0) {
    body = <ChatSkeleton />;
  } else if (error && chats.length === 0) {
    body = <EmptyState icon="cloud-offline" title="No pudimos cargar tus chats" body={error} action="Reintentar" onAction={onRefresh} />;
  } else if (visible.length === 0) {
    body = chats.length === 0 ? (
      business
        ? <EmptyState icon="file-tray" title="Tu bandeja está vacía" body="Cuando un cliente te escriba desde tu perfil de negocio, su conversación aparecerá aquí." action="Ver mi perfil público" onAction={() => active && router.push({ pathname: '/b/[id]', params: { id: active.business.id } })} />
        : <EmptyState icon="chatbubbles" title="Aún no tienes chats" body="Busca a alguien por su número de teléfono y empieza a conversar." action="Nuevo chat" onAction={() => router.push('/new-chat')} />
    ) : <EmptyState icon="search" title="Sin resultados" body="Prueba con otra búsqueda o cambia el filtro." />;
  } else {
    body = null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={body ? [] : visible}
        keyExtractor={(x) => x.id}
        ListHeaderComponent={<>{header}{!business && filter === 'all' && !q && <InvitationsBanner />}{atRow}{botRow}</>}
        ListEmptyComponent={body}
        renderItem={({ item }) => <ChatRow chat={item} selected={item.id === selectedId} showState={business} onMenu={business ? undefined : setMenuFor} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: embedded ? 24 : 12 }}
        stickyHeaderIndices={[]}
      />
      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor ? chatTitle(menuFor) : undefined}>
        {menuFor && (() => {
          const m = menuFor;
          const run = async (change: Partial<Chat>, flags: Parameters<typeof setChatFlags>[1], msg?: string) => {
            setMenuFor(null); patch(m.id, change);
            try { await setChatFlags(m.id, flags); if (msg) toast.show(msg, 'success'); refresh(); } catch (e) { toast.show(friendly(e, 'No se pudo actualizar el chat.'), 'error'); refresh(); }
          };
          const muted = !!m.muted_until && new Date(m.muted_until) > new Date();
          const until = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();
          return (
            <>
              <SheetRow icon={m.pinned_at ? 'pin-outline' : 'pin'} label={m.pinned_at ? 'Desfijar chat' : 'Fijar arriba'} sub={m.pinned_at ? undefined : 'Hasta 5 chats fijados'} onPress={() => run({ pinned_at: m.pinned_at ? null : new Date().toISOString() }, { pinned: !m.pinned_at })} />
              <SheetRow icon={m.unread > 0 || m.marked_unread ? 'mail-open' : 'mail-unread'} label={m.unread > 0 || m.marked_unread ? 'Marcar como leído' : 'Marcar como no leído'} onPress={() => (m.unread > 0 || m.marked_unread ? run({ unread: 0, marked_unread: false }, { unread: false }) : run({ marked_unread: true }, { unread: true }))} />
              <SheetRow icon={m.archived ? 'arrow-undo' : 'archive'} label={m.archived ? 'Sacar del archivo' : 'Archivar'} sub={m.archived ? undefined : 'Se oculta de la lista hasta que lo abras desde Archivados'} onPress={() => run({ archived: !m.archived }, { archived: !m.archived }, m.archived ? 'Chat restaurado' : 'Chat archivado')} />
              {muted
                ? <SheetRow icon="notifications" label="Activar notificaciones" onPress={() => run({ muted_until: null }, { unmute: true })} />
                : <>
                    <SheetRow icon="notifications-off" label="Silenciar 8 horas" onPress={() => run({ muted_until: until(8) }, { mutedUntil: until(8) }, 'Silenciado 8 horas')} />
                    <SheetRow icon="notifications-off-outline" label="Silenciar siempre" onPress={() => run({ muted_until: until(24 * 365) }, { mutedUntil: until(24 * 365) }, 'Chat silenciado')} />
                  </>}
            </>
          );
        })()}
      </Sheet>
      <Sheet visible={switcher} onClose={() => setSwitcher(false)} title="Tus negocios">
        {businesses.map((b) => (
          <SheetRow key={b.business.id} icon="storefront" label={b.business.name} sub={b.role === 'owner' ? 'Propietario' : b.role} right={active?.business.id === b.business.id ? <Icon name="checkmark-circle" tone="accent" /> : undefined}
            onPress={() => { setActiveBusiness(b.business.id); setSwitcher(false); }} />
        ))}
        <SheetRow icon="add-circle" label="Crear otro negocio" tone="accent" onPress={() => { setSwitcher(false); router.push('/business-create'); }} />
      </Sheet>
    </View>
  );
}

export function BusinessOnboarding() {
  const { c } = useTheme();
  const perks = [
    { icon: 'file-tray-full' as const, t: 'Bandeja compartida', b: 'Todo tu equipo atiende desde un mismo lugar, con estados y asignación.' },
    { icon: 'pricetags' as const, t: 'Catálogo en el chat', b: 'Muestra tus productos y servicios a quien te escribe.' },
    { icon: 'flash' as const, t: 'Respuestas automáticas', b: 'Saludo de bienvenida, mensajes de ausencia y respuestas rápidas.' },
  ];
  return (
    <View style={{ padding: 20, gap: 14 }}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 14 }}>
        <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="storefront" size={40} color={c.accentText} /></View>
        <Txt v="h1" style={{ textAlign: 'center' }}>Lleva tu negocio a CIFRA</Txt>
        <Txt tone="muted" style={{ textAlign: 'center', maxWidth: 340 }}>Crea tu espacio Business en un minuto. Tu cuenta personal sigue separada y solo a un toque.</Txt>
      </View>
      {perks.map((p) => (
        <View key={p.t} style={{ flexDirection: 'row', gap: 14, padding: 16, backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon} size={20} color={c.accentSoftText} /></View>
          <View style={{ flex: 1 }}><Txt v="bodyStrong">{p.t}</Txt><Txt v="small" tone="muted">{p.b}</Txt></View>
        </View>
      ))}
      <Pressy onPress={() => router.push('/business-create')} accessibilityRole="button" style={{ height: 56, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <Txt v="bodyStrong" style={{ color: c.accentText }}>Crear mi negocio</Txt><Icon name="arrow-forward" size={19} color={c.accentText} />
      </Pressy>
    </View>
  );
}
