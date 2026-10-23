import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostComposer } from '../../features/status/PostComposer';
import { StatusViewer } from '../../features/status/StatusViewer';
import { PersonCard, StatusRow, deleteStatus, getProfiles, listBusinessPosts, listStatuses } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { relative } from '../../lib/format';
import { useAuth } from '../../state/AuthProvider';
import { useChats } from '../../state/ChatsProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, EmptyState, Icon, IconButton, Pressy, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

type Biz = { id: string; name: string; logo: string | null; handle: string | null };

export default function Updates() {
  const { c } = useTheme();
  const { user, profile } = useAuth();
  const { chats } = useChats();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [posts, setPosts] = useState<StatusRow[]>([]);
  const [people, setPeople] = useState<Record<string, PersonCard>>({});
  const [add, setAdd] = useState(false);
  const [viewing, setViewing] = useState<{ kind: 'person' | 'business'; id: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Businesses you talk to (the ones whose posts show up here), from your own chat list.
  const businesses = useMemo<Biz[]>(() => {
    const map = new Map<string, Biz>();
    chats.forEach((x) => { if (x.kind === 'business' && x.perspective === 'personal' && x.business_id) map.set(x.business_id, { id: x.business_id, name: x.business_name ?? x.peer_name ?? 'Negocio', logo: x.peer_avatar, handle: x.business_handle }); });
    return [...map.values()];
  }, [chats]);

  const load = useCallback(async () => {
    try {
      const [list, feed] = await Promise.all([listStatuses(), listBusinessPosts(businesses.map((b) => b.id)).catch(() => [] as StatusRow[])]);
      setRows(list); setPosts(feed);
      const ids = [...new Set(list.map((s) => s.user_id))].filter((id) => id !== user?.id);
      if (ids.length) { const p = await getProfiles(ids); setPeople(Object.fromEntries(p.map((x) => [x.id, x]))); }
    } catch (e) { toast.show(friendly(e), 'error'); setRows((r) => r ?? []); }
  }, [user?.id, toast, businesses]);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, StatusRow[]>();
    (rows ?? []).forEach((s) => map.set(s.user_id, [...(map.get(s.user_id) ?? []), s]));
    return map;
  }, [rows]);
  const byBiz = useMemo(() => {
    const map = new Map<string, StatusRow[]>();
    [...posts].reverse().forEach((s) => s.business_id && map.set(s.business_id, [...(map.get(s.business_id) ?? []), s]));
    return map;
  }, [posts]);
  const mine = groups.get(user?.id ?? '') ?? [];
  const others = [...groups.entries()].filter(([id]) => id !== user?.id).sort((a, b) => (a[1][a[1].length - 1].created_at < b[1][b[1].length - 1].created_at ? 1 : -1));
  const bizWithPosts = businesses.filter((b) => byBiz.has(b.id)).sort((a, b) => (byBiz.get(a.id)!.at(-1)!.created_at < byBiz.get(b.id)!.at(-1)!.created_at ? 1 : -1));

  const viewingItems = !viewing ? [] : viewing.kind === 'business' ? byBiz.get(viewing.id) ?? [] : viewing.id === user?.id ? mine : groups.get(viewing.id) ?? [];
  const viewingPerson = viewing?.kind === 'person' && viewing.id !== user?.id ? people[viewing.id] : null;
  const viewingBiz = viewing?.kind === 'business' ? businesses.find((b) => b.id === viewing.id) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.accent} />}>
        <View style={{ gap: 4, marginBottom: 18 }}><Txt v="h1">Estados</Txt><Txt tone="muted">Texto, foto o vídeo para tus contactos. Desaparece a las 24 horas.</Txt></View>

        <Pressy onPress={() => (mine.length ? setViewing({ kind: 'person', id: user!.id }) : setAdd(true))} scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <View>
            <Avatar name={profile?.display_name} seed={user?.id} path={profile?.avatar_path} size={56} ring={mine.length > 0} />
            <View style={{ position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: 12, backgroundColor: c.accent, borderWidth: 2.5, borderColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="add" size={15} color={c.accentText} /></View>
          </View>
          <View style={{ flex: 1 }}><Txt v="bodyStrong">Mi estado</Txt><Txt v="small" tone="muted">{mine.length ? `${mine.length} ${mine.length === 1 ? 'publicación' : 'publicaciones'} · ${relative(mine[mine.length - 1].created_at)}` : 'Toca para añadir texto, una foto o un vídeo'}</Txt></View>
          {mine.length > 0 && <IconButton icon="add-circle" label="Añadir estado" tone="accent" onPress={() => setAdd(true)} />}
        </Pressy>

        {bizWithPosts.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 26, marginBottom: 8, marginLeft: 4 }}><Icon name="storefront" size={12} tone="faint" /><Txt v="mono" tone="faint">NEGOCIOS</Txt></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 4, paddingHorizontal: 2 }}>
              {bizWithPosts.map((b) => {
                const list = byBiz.get(b.id)!;
                const last = list[list.length - 1];
                return (
                  <Pressy key={b.id} onPress={() => setViewing({ kind: 'business', id: b.id })} accessibilityRole="button" accessibilityLabel={t('Publicaciones de {name}', { name: b.name })} scale={0.95} style={{ width: 84, alignItems: 'center', gap: 6 }}>
                    <View style={{ padding: 2.5, borderRadius: 24, borderWidth: 2, borderColor: '#F5A524' }}><Avatar name={b.name} seed={b.id} path={b.logo} size={60} business /></View>
                    <Txt v="caption" numberOfLines={1} style={{ textAlign: 'center' }}>{b.name}</Txt>
                    <Txt v="caption" tone="faint" style={{ fontSize: 10 }}>{last.kind === 'video' ? '🎬 ' : ''}{relative(last.created_at)}</Txt>
                  </Pressy>
                );
              })}
            </ScrollView>
          </>
        )}

        <Txt v="mono" tone="faint" style={{ marginTop: 26, marginBottom: 8, marginLeft: 4 }}>RECIENTES</Txt>
        {rows === null ? null : others.length === 0 ? <EmptyState icon="aperture" title="Nada nuevo por aquí" body="Cuando tus contactos publiquen un estado, lo verás en esta lista." action={bizWithPosts.length ? undefined : 'Descubrir negocios'} onAction={bizWithPosts.length ? undefined : () => router.push('/new-chat')} /> : others.map(([uid, list]) => {
          const p = people[uid];
          const last = list[list.length - 1];
          return (
            <Pressy key={uid} onPress={() => setViewing({ kind: 'person', id: uid })} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16 }}>
              <Avatar name={p?.display_name} seed={uid} path={p?.avatar_path} size={54} ring />
              <View style={{ flex: 1 }}><Txt v="bodyStrong">{p?.display_name ?? 'Contacto'}</Txt><Txt v="small" tone="muted">{last.kind === 'video' ? '🎬 Vídeo · ' : last.kind === 'image' ? '📷 Foto · ' : ''}{relative(last.created_at)}</Txt></View>
            </Pressy>
          );
        })}
      </ScrollView>

      {user && <PostComposer visible={add} onClose={() => setAdd(false)} me={user.id} onPosted={load} />}

      <StatusViewer visible={!!viewing && viewingItems.length > 0} items={viewingItems}
        name={viewingBiz ? viewingBiz.name : viewing?.id === user?.id ? profile?.display_name ?? '' : viewingPerson?.display_name ?? ''}
        avatarPath={viewingBiz ? viewingBiz.logo : viewing?.id === user?.id ? profile?.avatar_path : viewingPerson?.avatar_path}
        seed={viewing?.id ?? ''} mine={viewing?.kind === 'person' && viewing.id === user?.id} business={viewingBiz ? { id: viewingBiz.id, handle: viewingBiz.handle } : null} onClose={() => setViewing(null)}
        onDelete={async (s) => { try { await deleteStatus(s.id); await load(); } catch (e) { toast.show(friendly(e), 'error'); } }} />
    </View>
  );
}
