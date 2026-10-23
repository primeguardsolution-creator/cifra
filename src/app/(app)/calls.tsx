import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatTitle } from '../../components/ChatRow';
import { useCall } from '../../features/calls/CallProvider';
import { Message, listCallMessages } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { dayLabel, messageTime } from '../../lib/format';
import { useAuth } from '../../state/AuthProvider';
import { useChats } from '../../state/ChatsProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Chip, ChatSkeleton, EmptyState, Icon, IconButton, Pressy, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

type Parsed = { kind: 'audio' | 'video'; missed: boolean; duration: string | null };
const parse = (body: string): Parsed => ({ kind: body.startsWith('📹') ? 'video' : 'audio', missed: /sin respuesta/.test(body), duration: body.match(/·\s*([0-9]+:[0-9]{2})/)?.[1] ?? null });

export default function Calls() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { chats, markCallsSeen } = useChats();
  const call = useCall();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Message[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => { try { setRows(await listCallMessages()); } catch (e) { toast.show(friendly(e), 'error'); setRows((r) => r ?? []); } };
  useEffect(() => { load(); }, [chats]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { markCallsSeen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byConv = useMemo(() => new Map(chats.map((x) => [x.id, x])), [chats]);
  const items = useMemo(() => (rows ?? []).filter((m) => byConv.get(m.conversation_id)?.kind === 'direct').map((m) => ({ m, p: parse(m.body ?? ''), chat: byConv.get(m.conversation_id)! }))
    .filter((x) => filter === 'all' || (x.p.missed && x.m.sender_id !== user?.id)), [rows, byConv, filter, user?.id]);

  const start = (chat: (typeof items)[number]['chat'], kind: 'audio' | 'video') => chat.peer_id && call.startCall({ id: chat.peer_id, name: chatTitle(chat), avatar: chat.peer_avatar }, kind);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={rows === null ? [] : items} keyExtractor={(x) => x.m.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.accent} />}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, gap: 14, paddingBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt v="h1">Llamadas</Txt>
              <IconButton icon="call" label="Nueva llamada" filled wiggle onPress={() => router.push('/contacts')} />
            </View>
            {!call.supported && <Txt v="small" tone="muted">Tu navegador no admite llamadas. Prueba con Chrome, Edge o Safari actualizados.</Txt>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="Todas" active={filter === 'all'} onPress={() => setFilter('all')} icon="list" />
              <Chip label="Perdidas" active={filter === 'missed'} onPress={() => setFilter('missed')} icon="call" />
            </View>
          </View>
        }
        ListEmptyComponent={rows === null ? <ChatSkeleton rows={6} /> : <EmptyState icon="call" title={filter === 'missed' ? 'Sin llamadas perdidas' : 'Aún no hay llamadas'} body={filter === 'missed' ? 'Aquí verás las llamadas que no pudiste atender.' : 'Llama gratis por internet a cualquier contacto. Aparecerán aquí con su duración.'} action={filter === 'all' ? 'Elegir un contacto' : undefined} onAction={filter === 'all' ? () => router.push('/contacts') : undefined} />}
        renderItem={({ item, index }) => {
          const { m, p, chat } = item;
          const mine = m.sender_id === user?.id;
          const missedIn = p.missed && !mine;
          const prev = items[index - 1];
          const newDay = !prev || new Date(prev.m.created_at).toDateString() !== new Date(m.created_at).toDateString();
          return (
            <View>
              {newDay && <Txt v="mono" tone="faint" style={{ marginTop: 12, marginBottom: 4, marginLeft: 18, textTransform: 'uppercase' }}>{dayLabel(m.created_at)}</Txt>}
              <Pressy onPress={() => router.push({ pathname: '/chat/[id]', params: { id: chat.id } })} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Avatar name={chatTitle(chat)} seed={chat.peer_id ?? chat.id} path={chat.peer_avatar} size={50} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="bodyStrong" numberOfLines={1} tone={missedIn ? 'danger' : 'text'}>{chatTitle(chat)}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name={mine ? 'arrow-up' : 'arrow-down'} size={13} color={missedIn ? c.danger : p.missed ? c.textFaint : c.highlight} />
                    <Txt v="small" tone="muted" numberOfLines={1}>{mine ? 'Saliente' : missedIn ? 'Perdida' : 'Entrante'}{p.duration ? ` · ${p.duration}` : p.missed && mine ? ' · Sin respuesta' : ''} · {messageTime(m.created_at)}</Txt>
                  </View>
                </View>
                {call.supported && (
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton icon="call-outline" label={t('Llamar a {name}', { name: chatTitle(chat) })} tone="accent" wiggle onPress={() => start(chat, 'audio')} />
                    <IconButton icon="videocam-outline" label={t('Videollamada a {name}', { name: chatTitle(chat) })} tone="accent" pop onPress={() => start(chat, 'video')} />
                  </View>
                )}
              </Pressy>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
