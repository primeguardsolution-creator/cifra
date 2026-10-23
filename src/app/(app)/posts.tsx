import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { BizHeader, Key, NoBusiness, Pill } from '../../components/BizUi';
import { PostComposer } from '../../features/status/PostComposer';
import { StatusViewer } from '../../features/status/StatusViewer';
import { BUSINESS_POST_DAYS, StatusRow, deleteStatus, listBusinessPosts } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { relative } from '../../lib/format';
import { WIDE } from '../../lib/layout';
import { signedMediaUrl } from '../../lib/media';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { statusBackgrounds } from '../../theme/tokens';
import { Icon, Pressy, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));

/** Thumbnail of one post: colour tile for text, signed image for photos, dark tile with a play badge for videos. */
function PostTile({ s, onPress }: { s: StatusRow; onPress: () => void }) {
  const { c, r } = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let live = true; if (s.kind === 'image' && s.media_path) signedMediaUrl(s.media_path).then((u) => live && setUrl(u)); return () => { live = false; }; }, [s.media_path, s.kind]);
  const bg = statusBackgrounds[s.bg % statusBackgrounds.length][1];
  return (
    <Pressy onPress={onPress} accessibilityRole="button" accessibilityLabel={s.body ?? (s.kind === 'video' ? 'Vídeo' : 'Foto')} scale={0.97} style={{ borderRadius: r(14), overflow: 'hidden', backgroundColor: s.kind === 'text' ? bg : '#0A0A08', borderWidth: 1, borderColor: c.border }}>
      <View style={{ aspectRatio: 0.8, alignItems: 'center', justifyContent: 'center', padding: 10 }}>
        {s.kind === 'image' && url ? <Image source={{ uri: url }} resizeMode="cover" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' } as object} /> : null}
        {s.kind === 'text' && <Txt v="smallStrong" numberOfLines={5} style={{ color: '#fff', textAlign: 'center' }}>{s.body}</Txt>}
        {s.kind === 'video' && <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={22} color="#fff" /></View>}
        {s.kind !== 'text' && s.body ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)' }}><Txt v="caption" numberOfLines={2} style={{ color: '#fff' }}>{s.body}</Txt></View> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: c.surface }}>
        <Icon name={s.kind === 'video' ? 'videocam' : s.kind === 'image' ? 'image' : 'text'} size={12} tone="faint" />
        <Txt v="caption" tone="muted" style={{ flex: 1 }} numberOfLines={1}>{relative(s.created_at)}</Txt>
        <Txt v="caption" tone="faint">{t('{n} d', { n: daysLeft(s.expires_at) })}</Txt>
      </View>
    </Pressy>
  );
}

/** Business space: the public feed of the active business (text, photos, videos; 7 days each). */
export default function Posts() {
  const { c, r } = useTheme();
  const { active } = useSpace();
  const { user } = useAuth();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const bid = active?.business.id;
  const canWrite = active?.role !== 'viewer';

  const load = useCallback(async () => {
    if (!bid) return;
    try { setRows(await listBusinessPosts([bid])); } catch (e) { setRows([]); toast.show(friendly(e), 'error'); }
  }, [bid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  if (!active) return <NoBusiness onCreate={() => router.push('/business-create')} />;
  const cols = width >= WIDE ? 4 : 3;
  const list = rows ?? [];
  const videos = list.filter((s) => s.kind === 'video').length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BizHeader eyebrow="Red del negocio" title="Publicaciones" sub={rows ? t('{n} activas · {v} vídeos', { n: list.length, v: videos }) : active.business.name}
        right={<><Key icon="eye" label="Ver perfil" onPress={() => router.push({ pathname: '/b/[id]', params: { id: active.business.id } })} />{canWrite && <Key primary icon="add" label="Publicar" onPress={() => setAdding(true)} />}</>} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.highlight} />}>
        <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: r(14), backgroundColor: c.accentSoft }}>
          <View style={{ width: 40, height: 40, borderRadius: r(12), backgroundColor: c.highlight, alignItems: 'center', justifyContent: 'center' }}><Icon name="megaphone" size={20} color={c.highlightText} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt v="smallStrong" style={{ color: c.accentSoftText }}>Tu escaparate dentro de CIFRA</Txt>
            <Txt v="caption" style={{ color: c.accentSoftText }}>{t('Cada publicación se ve en tu perfil público y en la pestaña Estados de quienes te escriben, durante {n} días. Vídeos cortos de producto, ofertas y novedades: con un toque te escriben.', { n: BUSINESS_POST_DAYS })}</Txt>
          </View>
        </View>

        {rows === null ? <Txt tone="muted" style={{ textAlign: 'center', padding: 30 }}>Cargando…</Txt> : list.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 30, gap: 10 }}>
            <Icon name="aperture-outline" size={34} tone="faint" /><Txt v="h3">Aún no has publicado nada</Txt>
            <Txt tone="muted" style={{ textAlign: 'center', maxWidth: 340 }}>Empieza con un vídeo corto de lo que vendes o una foto de tu local. Lo verán todos tus clientes.</Txt>
            {canWrite && <Key primary icon="add" label="Primera publicación" onPress={() => setAdding(true)} />}
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pill label={t('{n} activas', { n: list.length })} color={c.highlight} /><Txt v="caption" tone="faint">Toca una para verla como la ven tus clientes</Txt></View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {list.map((s, i) => <View key={s.id} style={{ flexBasis: `${100 / cols - 2}%`, flexGrow: 0 }}><PostTile s={s} onPress={() => setViewing(i)} /></View>)}
            </View>
          </>
        )}
      </ScrollView>

      {user && <PostComposer visible={adding} onClose={() => setAdding(false)} me={user.id} businessId={active.business.id} onPosted={load} />}
      <StatusViewer visible={viewing !== null && list.length > 0} items={viewing === null ? [] : [...list.slice(viewing), ...list.slice(0, viewing)]} name={active.business.name} avatarPath={active.business.logo_path} seed={active.business.id} mine business={{ id: active.business.id, handle: active.business.handle }} onClose={() => setViewing(null)}
        onDelete={async (s) => { try { await deleteStatus(s.id); await load(); toast.show('Publicación eliminada', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } }} />
    </View>
  );
}
