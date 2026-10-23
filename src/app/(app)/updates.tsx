import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusViewer } from '../../features/status/StatusViewer';
import { PersonCard, StatusRow, deleteStatus, getProfiles, listStatuses, postStatus } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { relative } from '../../lib/format';
import { pickPhoto, uploadMedia } from '../../lib/media';
import { useAuth } from '../../state/AuthProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { statusBackgrounds } from '../../theme/tokens';
import { Avatar, Button, EmptyState, Icon, IconButton, Pressy, Sheet, SheetRow, Txt, useToast } from '../../ui';
import { t, tr } from '../../i18n';

export default function Updates() {
  const { c } = useTheme();
  const { user, profile } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [people, setPeople] = useState<Record<string, PersonCard>>({});
  const [add, setAdd] = useState(false);
  const [compose, setCompose] = useState(false);
  const [text, setText] = useState('');
  const [bg, setBg] = useState(0);
  const [posting, setPosting] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listStatuses(); setRows(list);
      const ids = [...new Set(list.map((s) => s.user_id))].filter((id) => id !== user?.id);
      if (ids.length) { const p = await getProfiles(ids); setPeople(Object.fromEntries(p.map((x) => [x.id, x]))); }
    } catch (e) { toast.show(friendly(e), 'error'); setRows((r) => r ?? []); }
  }, [user?.id, toast]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const map = new Map<string, StatusRow[]>();
    (rows ?? []).forEach((s) => map.set(s.user_id, [...(map.get(s.user_id) ?? []), s]));
    return map;
  }, [rows]);
  const mine = groups.get(user?.id ?? '') ?? [];
  const others = [...groups.entries()].filter(([id]) => id !== user?.id).sort((a, b) => (a[1][a[1].length - 1].created_at < b[1][b[1].length - 1].created_at ? 1 : -1));

  const publishText = async () => {
    if (!user || !text.trim()) return;
    setPosting(true);
    try { await postStatus(user.id, { kind: 'text', body: text.trim(), bg }); setCompose(false); setText(''); await load(); toast.show('Estado publicado', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } finally { setPosting(false); }
  };
  const publishPhoto = async () => {
    if (!user) return; setAdd(false);
    try {
      const file = await pickPhoto({ max: 1400 }); if (!file) return;
      setPosting(true);
      const path = await uploadMedia('chat-media', `status/${user.id}`, file);
      await postStatus(user.id, { kind: 'image', media_path: path }); await load(); toast.show('Estado publicado', 'success');
    } catch (e) { toast.show(friendly(e), 'error'); } finally { setPosting(false); }
  };

  const viewingItems = viewing === user?.id ? mine : viewing ? groups.get(viewing) ?? [] : [];
  const viewingPerson = viewing && viewing !== user?.id ? people[viewing] : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.accent} />}>
        <View style={{ gap: 4, marginBottom: 18 }}><Txt v="h1">Estados</Txt><Txt tone="muted">Comparte un momento con tus contactos. Desaparece a las 24 horas.</Txt></View>

        <Pressy onPress={() => (mine.length ? setViewing(user!.id) : setAdd(true))} scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <View>
            <Avatar name={profile?.display_name} seed={user?.id} path={profile?.avatar_path} size={56} ring={mine.length > 0} />
            <View style={{ position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: 12, backgroundColor: c.accent, borderWidth: 2.5, borderColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="add" size={15} color={c.accentText} /></View>
          </View>
          <View style={{ flex: 1 }}><Txt v="bodyStrong">Mi estado</Txt><Txt v="small" tone="muted">{mine.length ? `${mine.length} ${mine.length === 1 ? 'publicación' : 'publicaciones'} · ${relative(mine[mine.length - 1].created_at)}` : 'Toca para añadir una actualización'}</Txt></View>
          {mine.length > 0 && <IconButton icon="add-circle" label="Añadir estado" tone="accent" onPress={() => setAdd(true)} />}
        </Pressy>

        <Txt v="mono" tone="faint" style={{ marginTop: 26, marginBottom: 8, marginLeft: 4 }}>RECIENTES</Txt>
        {rows === null ? null : others.length === 0 ? <EmptyState icon="aperture" title="Nada nuevo por aquí" body="Cuando tus contactos publiquen un estado, lo verás en esta lista." /> : others.map(([uid, list]) => {
          const p = people[uid];
          return (
            <Pressy key={uid} onPress={() => setViewing(uid)} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16 }}>
              <Avatar name={p?.display_name} seed={uid} path={p?.avatar_path} size={54} ring />
              <View style={{ flex: 1 }}><Txt v="bodyStrong">{p?.display_name ?? 'Contacto'}</Txt><Txt v="small" tone="muted">{relative(list[list.length - 1].created_at)}</Txt></View>
            </Pressy>
          );
        })}
      </ScrollView>

      <Sheet visible={add} onClose={() => setAdd(false)} title="Nuevo estado">
        <SheetRow icon="text" label="Texto" sub="Escribe algo sobre un fondo de color" onPress={() => { setAdd(false); setCompose(true); }} />
        <SheetRow icon="images" label="Foto" sub="Elige una imagen de tu galería" onPress={publishPhoto} />
      </Sheet>

      <Modal visible={compose} animationType="slide" onRequestClose={() => setCompose(false)} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <LinearGradient colors={statusBackgrounds[bg]} style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 }}>
              <IconButton icon="close" label="Cancelar" onPress={() => setCompose(false)} size={46} />
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {statusBackgrounds.map((g, i) => <Pressy key={i} onPress={() => setBg(i)} accessibilityLabel={t('Fondo {n}', { n: i + 1 })} scale={0.85} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: g[1], borderWidth: bg === i ? 3 : 1, borderColor: '#fff' }}><View /></Pressy>)}
              </View>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30, maxWidth: 560, alignSelf: 'center', width: '100%' }}>
              <TextInput value={text} onChangeText={setText} multiline maxLength={400} autoFocus placeholder={tr('Escribe un estado')} placeholderTextColor="rgba(255,255,255,0.6)" selectionColor="#fff" accessibilityLabel={tr('Texto del estado')}
                style={{ color: '#fff', fontSize: 30, lineHeight: 38, textAlign: 'center', fontFamily: 'Inter_700Bold', outlineStyle: 'none' } as object} />
            </View>
            <View style={{ paddingHorizontal: 20, maxWidth: 560, alignSelf: 'center', width: '100%' }}>
              <Button title="Publicar" variant="secondary" size="lg" icon="send" loading={posting} disabled={!text.trim()} onPress={publishText} />
            </View>
          </LinearGradient>
        </KeyboardAvoidingView>
      </Modal>

      <StatusViewer visible={!!viewing && viewingItems.length > 0} items={viewingItems} name={viewing === user?.id ? profile?.display_name ?? '' : viewingPerson?.display_name ?? ''} avatarPath={viewing === user?.id ? profile?.avatar_path : viewingPerson?.avatar_path} seed={viewing ?? ''} mine={viewing === user?.id} onClose={() => setViewing(null)}
        onDelete={async (s) => { try { await deleteStatus(s.id); await load(); } catch (e) { toast.show(friendly(e), 'error'); } }} />
    </View>
  );
}
