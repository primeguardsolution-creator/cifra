import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContactRow, PersonCard, deleteContact, getProfiles, listContacts, startDirectChat } from '../../lib/api';
import { useCall } from '../../features/calls/CallProvider';
import { friendly } from '../../lib/errors';
import { formatPhone } from '../../lib/phone';
import { appUrl, inviteMessage, shareText } from '../../lib/share';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, ChatSkeleton, EmptyState, Field, Icon, IconButton, Pressy, Sheet, SheetRow, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

export default function Contacts() {
  const { c } = useTheme();
  const toast = useToast();
  const call = useCall();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<ContactRow[] | null>(null);
  const [people, setPeople] = useState<Record<string, PersonCard>>({});
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<ContactRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listContacts(); setRows(list);
      // Contacts saved by @username have no phone: their card (avatar, @usuario) comes from the profile.
      const ids = list.map((x) => x.contact_user_id).filter((x): x is string => !!x);
      if (ids.length) getProfiles(ids).then((p) => setPeople(Object.fromEntries(p.map((x) => [x.id, x])))).catch(() => {});
    } catch (e) { toast.show(friendly(e), 'error'); setRows((r) => r ?? []); }
  }, [toast]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (x: ContactRow) => {
    if (!x.contact_user_id) return;
    try { const id = await startDirectChat(x.contact_user_id); router.push({ pathname: '/chat/[id]', params: { id } }); } catch (e) { toast.show(friendly(e), 'error'); }
  };
  const sub = (x: ContactRow) => {
    const p = x.contact_user_id ? people[x.contact_user_id] : undefined;
    return [x.phone ? formatPhone(x.phone) : null, p?.username ? `@${p.username}` : null].filter(Boolean).join(' · ') || (x.contact_user_id ? 'Contacto por @usuario' : '');
  };
  const needle = q.trim().toLowerCase();
  const shown = (rows ?? []).filter((x) => !needle || x.display_name.toLowerCase().includes(needle) || (x.phone ?? '').includes(needle) || (x.contact_user_id && (people[x.contact_user_id]?.username ?? '').includes(needle.replace(/^@/, ''))));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={rows === null ? [] : shown} keyExtractor={(x) => x.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.accent} />}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, gap: 14, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt v="h1">Contactos</Txt>
              <IconButton icon="person-add" label="Añadir contacto" filled pop onPress={() => setAddOpen(true)} />
            </View>
            <Field value={q} onChangeText={setQ} placeholder="Buscar por nombre, @usuario o teléfono" icon="search" autoCapitalize="none" style={{ paddingVertical: 10 }} />
            <Pressy onPress={async () => toast.show((await shareText(inviteMessage, appUrl())) === 'copied' ? 'Invitación copiada' : 'Invitación enviada', 'success')} scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, backgroundColor: c.accentSoft }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="share-social" size={20} color={c.accentText} /></View>
              <View style={{ flex: 1 }}><Txt v="bodyStrong" style={{ color: c.accentSoftText }}>Invitar a CIFRA</Txt><Txt v="small" style={{ color: c.accentSoftText, opacity: 0.8 }}>Comparte el enlace con tus amigos</Txt></View>
            </Pressy>
          </View>
        }
        ListEmptyComponent={rows === null ? <ChatSkeleton rows={5} /> : <EmptyState icon="people" title={q ? 'Sin resultados' : 'Aún no tienes contactos'} body={q ? undefined : 'Añade a alguien por su @usuario o por su número: también se guardan solos al iniciar un chat.'} action={q ? undefined : 'Añadir contacto'} onAction={q ? undefined : () => setAddOpen(true)} />}
        renderItem={({ item }) => (
          <Pressy onPress={() => open(item)} onLongPress={() => setSel(item)} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Avatar name={item.display_name} seed={item.contact_user_id ?? item.id} path={item.contact_user_id ? people[item.contact_user_id]?.avatar_path : null} size={48} />
            <View style={{ flex: 1 }}><Txt v="bodyStrong">{item.display_name}</Txt><Txt v="small" tone="muted" numberOfLines={1}>{sub(item)}</Txt></View>
            {call.supported && item.contact_user_id && <>
              <IconButton icon="call-outline" label={t('Llamar a {name}', { name: item.display_name })} tone="accent" size={38} wiggle onPress={() => call.startCall({ id: item.contact_user_id!, name: item.display_name }, 'audio')} />
              <IconButton icon="videocam-outline" label={t('Videollamada a {name}', { name: item.display_name })} tone="accent" size={38} pop onPress={() => call.startCall({ id: item.contact_user_id!, name: item.display_name }, 'video')} />
            </>}
            <IconButton icon="ellipsis-horizontal" label="Opciones" tone="muted" size={36} onPress={() => setSel(item)} />
          </Pressy>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Añadir contacto">
        <SheetRow icon="at" label="Por @usuario" sub="Sin compartir números de teléfono" onPress={() => { setAddOpen(false); router.push({ pathname: '/new-chat', params: { mode: 'user' } }); }} />
        <SheetRow icon="call" label="Por número de teléfono" sub="Solo si ya tiene cuenta en CIFRA" onPress={() => { setAddOpen(false); router.push('/new-chat'); }} />
      </Sheet>
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.display_name}>
        <SheetRow icon="chatbubble" label="Enviar mensaje" onPress={() => { const x = sel!; setSel(null); open(x); }} />
        {sel?.contact_user_id && <SheetRow icon="person" label="Ver perfil" onPress={() => { const id = sel!.contact_user_id!; setSel(null); router.push({ pathname: '/user/[id]', params: { id } }); }} />}
        <SheetRow icon="trash" label="Eliminar contacto" tone="danger" onPress={async () => { const x = sel!; setSel(null); try { await deleteContact(x.id); setRows((r) => r?.filter((y) => y.id !== x.id) ?? r); toast.show('Contacto eliminado', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } }} />
      </Sheet>
    </View>
  );
}
