import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatTitle } from '../../components/ChatRow';
import { Business, SearchHit, UserHit, saveContact, searchBusinesses, searchMessages, searchUsers, startDirectChat } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { listTime } from '../../lib/format';
import { useAuth } from '../../state/AuthProvider';
import { useChats } from '../../state/ChatsProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, EmptyState, Field, Icon, IconButton, Pressy, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

type BizHit = Pick<Business, 'id' | 'name' | 'handle' | 'category' | 'description' | 'logo_path'>;
/** A query that can be an @username / @handle (with or without the @). */
const asHandle = (q: string) => { const m = q.trim().match(/^@?([A-Za-z0-9_-]{2,48})$/); return m ? m[1].toLowerCase() : null; };

/** People found by @username: start a chat, or save them as a contact first. */
function PersonHit({ p, onAdded }: { p: UserHit; onAdded: (id: string) => void }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<'chat' | 'add' | null>(null);
  const chat = async () => {
    setBusy('chat');
    try { const id = await startDirectChat(p.id); if (!p.is_contact && user) saveContact(user.id, { display_name: p.display_name, phone: null, contact_user_id: p.id }).catch(() => {}); router.push({ pathname: '/chat/[id]', params: { id } }); }
    catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(null); }
  };
  const add = async () => {
    if (!user) return; setBusy('add');
    try { await saveContact(user.id, { display_name: p.display_name, phone: null, contact_user_id: p.id }); onAdded(p.id); toast.show(t('{name} añadido a tus contactos', { name: p.display_name }), 'success'); }
    catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(null); }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
      <Pressy onPress={() => router.push({ pathname: '/user/[id]', params: { id: p.id } })} scale={0.98} accessibilityRole="button" accessibilityLabel={t('Ver perfil de {name}', { name: p.display_name })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={p.display_name} seed={p.id} path={p.avatar_path} size={42} />
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong" numberOfLines={1}>{p.display_name}{p.is_self ? ' (tú)' : ''}</Txt>
          <Txt v="caption" tone="muted">@{p.username}{p.is_contact ? ' · En tus contactos' : ''}</Txt>
        </View>
      </Pressy>
      {!p.is_self && !p.is_contact && <IconButton icon="person-add-outline" label={t('Añadir a {name} a contactos', { name: p.display_name })} tone="accent" size={38} pop disabled={!!busy} onPress={add} />}
      {!p.is_self && <Pressy onPress={chat} disabled={!!busy} accessibilityRole="button" accessibilityLabel={t('Chatear con {name}', { name: p.display_name })} scale={0.94} style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
        <Txt v="caption" style={{ color: c.accentText, fontFamily: 'Inter_600SemiBold' }}>Chatear</Txt>
      </Pressy>}
    </View>
  );
}

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
  const [people, setPeople] = useState<UserHit[]>([]);
  const [shops, setShops] = useState<BizHit[]>([]);
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
    if (q.trim().length < 2) { setHits([]); setPeople([]); setShops([]); setBusy(false); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      // Messages, plus people and businesses by @username / @handle (so an account is found as soon as it exists).
      const handle = asHandle(q);
      const [msgs, ppl, biz] = await Promise.allSettled([
        searchMessages(q.trim().replace(/^@/, '')),
        handle && /^[a-z0-9_]{2,32}$/.test(handle) ? searchUsers(handle) : Promise.resolve([] as UserHit[]),
        handle ? searchBusinesses(handle) : Promise.resolve([] as BizHit[]),
      ]);
      if (mine !== seq.current) return;
      setHits(msgs.status === 'fulfilled' ? msgs.value : []);
      setPeople(ppl.status === 'fulfilled' ? ppl.value : []);
      setShops(biz.status === 'fulfilled' ? biz.value.slice(0, 4) : []);
      setError(msgs.status === 'rejected' ? friendly(msgs.reason) : null);
      setBusy(false);
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const open = (conv: string, m?: string) => router.push({ pathname: '/chat/[id]', params: m ? { id: conv, m } : { id: conv } });
  const shown = hits.filter((h) => byConv.has(h.conversation_id));
  const anyAbove = matchingChats.length > 0 || people.length > 0 || shops.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} />
        <View style={{ flex: 1 }}>
          <Field value={q} onChangeText={setQ} autoFocus placeholder="Buscar mensajes, @usuarios y negocios" icon="search" autoCapitalize="none" autoCorrect={false} style={{ paddingVertical: 10 }}
            right={busy ? <ActivityIndicator color={c.accent} /> : q ? <IconButton icon="close-circle" label="Borrar" tone="muted" size={30} onPress={() => setQ('')} /> : undefined} />
        </View>
      </View>
      <FlatList
        data={shown} keyExtractor={(h) => h.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}
        ListHeaderComponent={anyAbove ? (
          <View style={{ paddingTop: 12 }}>
            {people.length > 0 && (
              <>
                <Txt v="mono" tone="faint" style={{ marginLeft: 18, marginBottom: 4 }}>PERSONAS</Txt>
                {people.map((p) => <PersonHit key={p.id} p={p} onAdded={(id) => setPeople((cur) => cur.map((x) => (x.id === id ? { ...x, is_contact: true } : x)))} />)}
              </>
            )}
            {shops.length > 0 && (
              <>
                <Txt v="mono" tone="faint" style={{ marginLeft: 18, marginTop: people.length ? 14 : 0, marginBottom: 4 }}>NEGOCIOS</Txt>
                {shops.map((b) => (
                  <Pressy key={b.id} onPress={() => router.push({ pathname: '/b/[id]', params: { id: b.id } })} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <Avatar name={b.name} seed={b.id} path={b.logo_path} size={42} business />
                    <View style={{ flex: 1 }}><Txt v="bodyStrong" numberOfLines={1}>{b.name}</Txt><Txt v="caption" tone="muted" numberOfLines={1}>Business · @{b.handle}{b.category ? ` · ${b.category}` : ''}</Txt></View>
                    <Icon name="chevron-forward" size={16} tone="faint" />
                  </Pressy>
                ))}
              </>
            )}
            {matchingChats.length > 0 && (
              <>
                <Txt v="mono" tone="faint" style={{ marginLeft: 18, marginTop: people.length || shops.length ? 14 : 0, marginBottom: 4 }}>CHATS</Txt>
                {matchingChats.map((x) => (
                  <Pressy key={x.id} onPress={() => open(x.id)} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <Avatar name={chatTitle(x)} seed={x.peer_id ?? x.id} path={x.peer_avatar} size={42} group={x.kind === 'group'} business={x.kind === 'business' && x.perspective === 'personal'} />
                    <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{chatTitle(x)}</Txt>
                    <Icon name="chevron-forward" size={16} tone="faint" />
                  </Pressy>
                ))}
              </>
            )}
            {shown.length > 0 && <Txt v="mono" tone="faint" style={{ marginLeft: 18, marginTop: 14, marginBottom: 4 }}>MENSAJES</Txt>}
          </View>
        ) : shown.length > 0 ? <Txt v="mono" tone="faint" style={{ marginLeft: 18, marginTop: 14, marginBottom: 4 }}>MENSAJES</Txt> : null}
        ListEmptyComponent={
          q.trim().length < 2 ? <EmptyState icon="search" title="Busca en todo CIFRA" body="Mensajes de cualquier chat, personas por su @usuario y negocios por su @identificador. Solo tú ves los resultados." />
          : busy || anyAbove ? null : <EmptyState icon="search" title="Sin resultados" body={error ?? (asHandle(q) ? t('No hay nadie con @{q} ni mensajes con ese texto.', { q: asHandle(q) ?? '' }) : t('No hay mensajes que contengan “{q}”.', { q: q.trim() }))} />
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
