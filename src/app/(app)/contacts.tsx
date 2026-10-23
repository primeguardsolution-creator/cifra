import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContactRow, deleteContact, listContacts, startDirectChat } from '../../lib/api';
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
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<ContactRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { try { setRows(await listContacts()); } catch (e) { toast.show(friendly(e), 'error'); setRows((r) => r ?? []); } }, [toast]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (x: ContactRow) => {
    if (!x.contact_user_id) return;
    try { const id = await startDirectChat(x.contact_user_id); router.push({ pathname: '/chat/[id]', params: { id } }); } catch (e) { toast.show(friendly(e), 'error'); }
  };
  const shown = (rows ?? []).filter((x) => !q.trim() || x.display_name.toLowerCase().includes(q.trim().toLowerCase()) || (x.phone ?? '').includes(q.trim()));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={rows === null ? [] : shown} keyExtractor={(x) => x.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.accent} />}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, gap: 14, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt v="h1">Contactos</Txt>
              <IconButton icon="person-add" label="Añadir contacto" filled onPress={() => router.push('/new-chat')} />
            </View>
            <Field value={q} onChangeText={setQ} placeholder="Buscar contactos" icon="search" style={{ paddingVertical: 10 }} />
            <Pressy onPress={async () => toast.show((await shareText(inviteMessage, appUrl())) === 'copied' ? 'Invitación copiada' : 'Invitación enviada', 'success')} scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, backgroundColor: c.accentSoft }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="share-social" size={20} color={c.accentText} /></View>
              <View style={{ flex: 1 }}><Txt v="bodyStrong" style={{ color: c.accentSoftText }}>Invitar a CIFRA</Txt><Txt v="small" style={{ color: c.accentSoftText, opacity: 0.8 }}>Comparte el enlace con tus amigos</Txt></View>
            </Pressy>
          </View>
        }
        ListEmptyComponent={rows === null ? <ChatSkeleton rows={5} /> : <EmptyState icon="people" title={q ? 'Sin resultados' : 'Aún no tienes contactos'} body={q ? undefined : 'Cuando inicies un chat por número, la persona se guardará aquí.'} action={q ? undefined : 'Buscar por número'} onAction={q ? undefined : () => router.push('/new-chat')} />}
        renderItem={({ item }) => (
          <Pressy onPress={() => open(item)} onLongPress={() => setSel(item)} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Avatar name={item.display_name} seed={item.contact_user_id ?? item.id} size={48} />
            <View style={{ flex: 1 }}><Txt v="bodyStrong">{item.display_name}</Txt><Txt v="small" tone="muted">{formatPhone(item.phone)}</Txt></View>
            {call.supported && item.contact_user_id && <>
              <IconButton icon="call-outline" label={t('Llamar a {name}', { name: item.display_name })} tone="accent" size={38} wiggle onPress={() => call.startCall({ id: item.contact_user_id!, name: item.display_name }, 'audio')} />
              <IconButton icon="videocam-outline" label={t('Videollamada a {name}', { name: item.display_name })} tone="accent" size={38} pop onPress={() => call.startCall({ id: item.contact_user_id!, name: item.display_name }, 'video')} />
            </>}
            <IconButton icon="ellipsis-horizontal" label="Opciones" tone="muted" size={36} onPress={() => setSel(item)} />
          </Pressy>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.display_name}>
        <SheetRow icon="chatbubble" label="Enviar mensaje" onPress={() => { const x = sel!; setSel(null); open(x); }} />
        <SheetRow icon="trash" label="Eliminar contacto" tone="danger" onPress={async () => { const x = sel!; setSel(null); try { await deleteContact(x.id); setRows((r) => r?.filter((y) => y.id !== x.id) ?? r); toast.show('Contacto eliminado', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } }} />
      </Sheet>
    </View>
  );
}
