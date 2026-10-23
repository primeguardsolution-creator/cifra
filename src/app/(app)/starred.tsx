import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatTitle } from '../../components/ChatRow';
import { StarredRow, listStarred, starMessage } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { listTime } from '../../lib/format';
import { useAuth } from '../../state/AuthProvider';
import { useChats } from '../../state/ChatsProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, ChatSkeleton, EmptyState, Icon, IconButton, Pressy, Txt, useToast } from '../../ui';

export default function Starred() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { chats } = useChats();
  const toast = useToast();
  const [rows, setRows] = useState<StarredRow[] | null>(null);
  useEffect(() => { listStarred().then(setRows).catch((e) => { toast.show(friendly(e), 'error'); setRows([]); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const byConv = new Map(chats.map((x) => [x.id, x]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 6 }}>
        <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
        <Txt v="h2">Mensajes destacados</Txt>
      </View>
      {rows === null ? <ChatSkeleton rows={4} /> : (
        <FlatList data={rows} keyExtractor={(r) => r.message.id} contentContainerStyle={{ paddingBottom: 30 }}
          ListEmptyComponent={<EmptyState icon="star" title="Aún no destacaste nada" body="Mantén pulsado un mensaje y elige “Destacar” para guardarlo aquí y encontrarlo al instante." />}
          renderItem={({ item }) => {
            const m = item.message; const chat = byConv.get(m.conversation_id);
            return (
              <Pressy onPress={() => router.push({ pathname: '/chat/[id]', params: { id: m.conversation_id, m: m.id } })} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                {chat ? <Avatar name={chatTitle(chat)} seed={chat.peer_id ?? chat.id} path={chat.peer_avatar} size={42} group={chat.kind === 'group'} /> : <Icon name="star" size={24} tone="accent" />}
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="smallStrong" numberOfLines={1} style={{ flex: 1 }}>{chat ? chatTitle(chat) : 'Chat'}{m.sender_id === user?.id ? ' · Tú' : ''}</Txt><Txt v="mono" tone="faint">{listTime(m.created_at)}</Txt></View>
                  <Txt tone="muted" numberOfLines={3}>{m.body ?? (m.attachment_type?.startsWith('audio') ? '🎤 Mensaje de voz' : m.attachment_type?.startsWith('image') ? '📷 Foto' : '📎 Archivo')}</Txt>
                </View>
                <IconButton icon="star" label="Quitar de destacados" tone="accent" size={36} pop onPress={async () => { if (!user) return; setRows((r) => r?.filter((x) => x.message.id !== m.id) ?? r); try { await starMessage(user.id, m.id, false); } catch (e) { toast.show(friendly(e), 'error'); } }} />
              </Pressy>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
