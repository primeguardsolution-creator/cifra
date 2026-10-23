import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatTitle } from '../../components/ChatRow';
import { SearchHit, searchMessages } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { listTime } from '../../lib/format';
import { useChats } from '../../state/ChatsProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, EmptyState, Field, Icon, IconButton, Pressy, Txt } from '../../ui';
import { t } from '../../i18n';

/** Splits `text` around `needle` so the match can be emphasised. */
function Highlight({ text, needle, color }: { text: string; needle: string; color: string }) {
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0 || !needle) return <Txt v="small" tone="muted" numberOfLines={2}>{text}</Txt>;
  const start = Math.max(0, i - 24);
  return (
    <Txt v="small" tone="muted" numberOfLines={2}>
      {start > 0 ? '…' : ''}{text.slice(start, i)}<Txt v="small" style={{ color, fontFamily: 'Inter_700Bold', backgroundColor: color + '22' }}>{text.slice(i, i + needle.length)}</Txt>{text.slice(i + needle.length)}
    </Txt>
  );
}

export default function Search() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const { chats } = useChats();
  const [q, setQ] = useState(params.q ?? '');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const byConv = useMemo(() => new Map(chats.map((x) => [x.id, x])), [chats]);

  const matchingChats = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n.length < 2 ? [] : chats.filter((x) => chatTitle(x).toLowerCase().includes(n) || (x.peer_phone ?? '').includes(n)).slice(0, 5);
  }, [q, chats]);

  useEffect(() => {
    const mine = ++seq.current;
    if (q.trim().length < 2) { setHits([]); setBusy(false); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      try { const r = await searchMessages(q.trim()); if (mine === seq.current) { setHits(r); setError(null); } } catch (e) { if (mine === seq.current) setError(friendly(e)); } finally { if (mine === seq.current) setBusy(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const open = (conv: string, m?: string) => router.push({ pathname: '/chat/[id]', params: m ? { id: conv, m } : { id: conv } });
  const shown = hits.filter((h) => byConv.has(h.conversation_id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} />
        <View style={{ flex: 1 }}>
          <Field value={q} onChangeText={setQ} autoFocus placeholder="Buscar en todos tus mensajes" icon="search" autoCapitalize="none" style={{ paddingVertical: 10 }}
            right={busy ? <ActivityIndicator color={c.accent} /> : q ? <IconButton icon="close-circle" label="Borrar" tone="muted" size={30} onPress={() => setQ('')} /> : undefined} />
        </View>
      </View>
      <FlatList
        data={shown} keyExtractor={(h) => h.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}
        ListHeaderComponent={matchingChats.length > 0 ? (
          <View style={{ paddingTop: 12 }}>
            <Txt v="mono" tone="faint" style={{ marginLeft: 18, marginBottom: 4 }}>CHATS</Txt>
            {matchingChats.map((x) => (
              <Pressy key={x.id} onPress={() => open(x.id)} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Avatar name={chatTitle(x)} seed={x.peer_id ?? x.id} path={x.peer_avatar} size={42} group={x.kind === 'group'} business={x.kind === 'business' && x.perspective === 'personal'} />
                <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{chatTitle(x)}</Txt>
                <Icon name="chevron-forward" size={16} tone="faint" />
              </Pressy>
            ))}
            {shown.length > 0 && <Txt v="mono" tone="faint" style={{ marginLeft: 18, marginTop: 14, marginBottom: 4 }}>MENSAJES</Txt>}
          </View>
        ) : shown.length > 0 ? <Txt v="mono" tone="faint" style={{ marginLeft: 18, marginTop: 14, marginBottom: 4 }}>MENSAJES</Txt> : null}
        ListEmptyComponent={
          q.trim().length < 2 ? <EmptyState icon="search" title="Busca en todo CIFRA" body="Encuentra cualquier mensaje por palabra, de cualquier chat. Solo tú puedes ver los resultados." />
          : busy || matchingChats.length > 0 ? null : <EmptyState icon="search" title="Sin resultados" body={error ?? t('No hay mensajes que contengan “{q}”.', { q: q.trim() })} />
        }
        renderItem={({ item }) => {
          const chat = byConv.get(item.conversation_id)!;
          return (
            <Pressy onPress={() => open(item.conversation_id, item.id)} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Avatar name={chatTitle(chat)} seed={chat.peer_id ?? chat.id} path={chat.peer_avatar} size={42} group={chat.kind === 'group'} business={chat.kind === 'business' && chat.perspective === 'personal'} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Txt v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{chatTitle(chat)}</Txt>
                  <Txt v="mono" tone="faint">{listTime(item.created_at)}</Txt>
                </View>
                <Highlight text={item.body} needle={q.trim()} color={c.accent} />
              </View>
            </Pressy>
          );
        }}
      />
    </SafeAreaView>
  );
}
