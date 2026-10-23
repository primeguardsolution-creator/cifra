import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Image, Modal, Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatTitle, stateMeta } from '../../../components/ChatRow';
import { Wallpaper } from '../../../components/Wallpaper';
import { useCall } from '../../../features/calls/CallProvider';
import { Bubble } from '../../../features/chat/Bubble';
import { Composer } from '../../../features/chat/Composer';
import { VideoModal } from '../../../features/chat/VideoPlayer';
import { ConversationState, Message, QuickReply, ScheduledRow, TeamMember, blockUser, cancelScheduled, listScheduled, scheduleMessage, starMessage, starredIds, leaveConversation, listBlocked, listQuickReplies, listTeam, unblockUser, updateBusinessConversation } from '../../../lib/api';
import { friendly } from '../../../lib/errors';
import { dayLabel } from '../../../lib/format';
import { WIDE } from '../../../lib/layout';
import { formatPhone } from '../../../lib/phone';
import { supabase } from '../../../lib/supabase';
import { useConversation } from '../../../features/chat/useConversation';
import { useAuth } from '../../../state/AuthProvider';
import { useChats } from '../../../state/ChatsProvider';
import { useSpace } from '../../../state/SpaceProvider';
import { useTheme } from '../../../theme/ThemeProvider';
import { Avatar, EmptyState, Icon, IconButton, Pressy, Sheet, SheetRow, Txt, TypingDots, useToast } from '../../../ui';
import { hapticSoft } from '../../../lib/haptics';
import { loc, t } from '../../../i18n';

type Row = { type: 'msg'; m: Message; joinedOlder: boolean; joinedNewer: boolean } | { type: 'day'; label: string; key: string };
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const SAME_GROUP_MS = 5 * 60 * 1000;

export default function ChatScreen() {
  const { id, m } = useLocalSearchParams<{ id: string; m?: string }>();
  const { user } = useAuth();
  if (!user || !id) return null;
  return <ChatInner id={id} me={user.id} jumpTo={m} />;
}

function ChatInner({ id, me, jumpTo: jumpToParam }: { id: string; me: string; jumpTo?: string }) {
  const { c } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const { patch, refresh } = useChats();
  const { active } = useSpace();
  const call = useCall();
  const conv = useConversation(id, me);
  const { chat, messages } = conv;
  const agent = chat?.perspective === 'agent';

  const [actionFor, setActionFor] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [statePicker, setStatePicker] = useState(false);
  const [assignPicker, setAssignPicker] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [stars, setStars] = useState<Set<string>>(new Set());
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([]);
  const [schedOpen, setSchedOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const list = useRef<FlatList<Row>>(null);

  const businessId = chat?.business_id ?? null;
  const myRole = active?.business.id === businessId ? active?.role : undefined;

  useEffect(() => {
    if (!chat) return;
    patch(chat.id, { unread: 0, marked_unread: false });
    if (chat.kind === 'direct' && chat.peer_id) listBlocked().then((b) => setBlocked(b.includes(chat.peer_id!))).catch(() => {});
  }, [chat?.id, chat?.peer_id, chat?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!agent || !businessId) return;
    listQuickReplies(businessId).then(setQuickReplies).catch(() => {});
    listTeam(businessId).then(setTeam).catch(() => {});
  }, [agent, businessId]);

  useEffect(() => {
    const ids = conv.messages.map((x) => x.id).filter((x) => !stars.has(x));
    if (ids.length) starredIds(conv.messages.map((x) => x.id)).then((r) => setStars(new Set(r))).catch(() => {});
  }, [conv.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadScheduled = useCallback(() => { listScheduled(id).then(setScheduled).catch(() => {}); }, [id]);
  useEffect(() => { loadScheduled(); }, [loadScheduled, conv.messages.length]);

  const jumped = useRef<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]; const older = messages[i + 1]; const newer = messages[i - 1];
      const day = new Date(m.created_at).toDateString();
      const sameAs = (o?: Message) => !!o && o.sender_id === m.sender_id && o.is_internal === m.is_internal && o.is_automated === m.is_automated && new Date(o.created_at).toDateString() === day && Math.abs(new Date(m.created_at).getTime() - new Date(o.created_at).getTime()) < SAME_GROUP_MS;
      out.push({ type: 'msg', m, joinedOlder: sameAs(older), joinedNewer: sameAs(newer) });
      if (!older || new Date(older.created_at).toDateString() !== day) out.push({ type: 'day', label: dayLabel(m.created_at), key: `day-${day}` });
    }
    return out;
  }, [messages]);

  useEffect(() => {
    if (!jumpToParam || jumped.current === jumpToParam || conv.loading) return;
    const index = rows.findIndex((r) => r.type === 'msg' && r.m.id === jumpToParam);
    if (index >= 0) {
      jumped.current = jumpToParam;
      setTimeout(() => { list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }); setFlash(jumpToParam); setTimeout(() => setFlash(null), 2200); }, 250);
    } else if (conv.hasMore && !conv.loadingMore) conv.loadOlder();
  }, [jumpToParam, rows, conv.loading, conv.hasMore, conv.loadingMore]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = useCallback((uid: string) => (uid === me ? 'Tú' : conv.people[uid]?.display_name ?? (uid === chat?.peer_id ? chat?.peer_name : undefined) ?? 'Alguien'), [conv.people, me, chat?.peer_id, chat?.peer_name]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  const guard = async (fn: () => Promise<unknown>, fallback?: string) => { try { await fn(); } catch (e) { toast.show(friendly(e, fallback), 'error'); } };

  const jumpTo = useCallback((mid: string) => {
    const index = rows.findIndex((r) => r.type === 'msg' && r.m.id === mid);
    if (index >= 0) list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  }, [rows]);

  const subtitle = conv.typingNow.length
    ? (chat?.kind === 'group' ? t('{name} está escribiendo…', { name: nameOf(conv.typingNow[0]) }) : 'escribiendo…')
    : chat?.kind === 'group' ? t('{n} participantes', { n: chat.member_count })
    : agent ? chat?.peer_phone ? formatPhone(chat.peer_phone) : 'Cliente'
    : chat?.kind === 'business' ? 'Cuenta de negocio'
    : chat?.peer_phone ? formatPhone(chat.peer_phone) : '';

  const disabledReason = blocked ? 'Has bloqueado a este contacto. Desbloquéalo para escribirle.' : agent && myRole === 'viewer' ? 'Tu rol es de solo lectura en este negocio.' : null;

  const setState = (s: ConversationState) => guard(async () => { await updateBusinessConversation(id, { state: s }); conv.setChat((x) => x && { ...x, state: s }); patch(id, { state: s }); refresh(); setStatePicker(false); });
  const assign = (uid: string | null) => guard(async () => { await updateBusinessConversation(id, { assigned: uid }); conv.setChat((x) => x && { ...x, assigned_to: uid }); patch(id, { assigned_to: uid }); refresh(); setAssignPicker(false); });

  const openProfile = () => {
    if (!chat) return;
    if (chat.kind === 'business' && !agent && chat.business_id) router.push({ pathname: '/b/[id]', params: { id: chat.business_id } });
    else if (chat.peer_id && chat.kind !== 'group') router.push({ pathname: '/user/[id]', params: { id: chat.peer_id } });
    else setMenu(true);
  };

  const header = (
    <View style={{ paddingTop: insets.top + 6, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 8, minHeight: 56 }}>
        {!wide && <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace(agent ? '/inbox' : '/chats'))} />}
        <Pressy onPress={openProfile} accessibilityRole="button" accessibilityLabel="Ver perfil" scale={0.99} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: wide ? 10 : 2 }}>
          {chat && <Avatar name={chatTitle(chat)} seed={chat.peer_id ?? chat.id} path={chat.peer_avatar} size={42} group={chat.kind === 'group'} business={chat.kind === 'business' && !agent} />}
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong" numberOfLines={1}>{chat ? chatTitle(chat) : ' '}</Txt>
            {conv.typingNow.length ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><TypingDots size={4} /><Txt v="caption" tone="accent" numberOfLines={1}>{chat?.kind === 'group' ? t('{name} escribe', { name: nameOf(conv.typingNow[0]) }) : 'escribiendo'}</Txt></View> : <Txt v="caption" tone="muted" numberOfLines={1}>{subtitle}</Txt>}
          </View>
        </Pressy>
        {agent && chat && (
          <Pressy onPress={() => setStatePicker(true)} accessibilityRole="button" accessibilityLabel="Cambiar estado" scale={0.95} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, height: 32, borderRadius: 16, backgroundColor: c.sunken }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stateMeta[chat.state].color }} /><Txt v="caption">{stateMeta[chat.state].label}</Txt>
          </Pressy>
        )}
        {call.supported && chat?.kind === 'direct' && chat.peer_id && !blocked && (
          <>
            <IconButton icon="call-outline" label="Llamada de voz" wiggle onPress={() => call.startCall({ id: chat.peer_id!, name: chatTitle(chat), avatar: chat.peer_avatar }, 'audio')} />
            <IconButton icon="videocam-outline" label="Videollamada" pop onPress={() => call.startCall({ id: chat.peer_id!, name: chatTitle(chat), avatar: chat.peer_avatar }, 'video')} />
          </>
        )}
        {agent && <IconButton icon="person-add-outline" label="Asignar" onPress={() => setAssignPicker(true)} badge={!chat?.assigned_to} />}
        <IconButton icon="ellipsis-horizontal" label="Más opciones" onPress={() => setMenu(true)} />
      </View>
    </View>
  );

  let body: React.ReactNode;
  if (conv.loading && !chat) body = <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>;
  else if (conv.error && !chat) body = <EmptyState icon="lock-closed" title="No se puede abrir" body={conv.error} action="Volver a mis chats" onAction={() => router.replace('/chats')} />;
  else body = (
    <FlatList
      ref={list} data={rows} inverted keyExtractor={(r) => (r.type === 'msg' ? r.m.id : r.key)}
      keyboardShouldPersistTaps="handled" onEndReached={conv.loadOlder} onEndReachedThreshold={0.4}
      onScrollToIndexFailed={() => {}}
      contentContainerStyle={{ paddingVertical: 12 }}
      ListFooterComponent={conv.loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={c.accent} /> : conv.hasMore ? null : <Notice />}
      ListEmptyComponent={conv.loading ? null : <View style={{ transform: [{ scaleY: -1 }] }}><EmptyState icon="chatbubble-ellipses" title="Empieza la conversación" body="Escribe el primer mensaje. Solo vosotros podéis verlo." /></View>}
      renderItem={({ item }) => {
        if (item.type === 'day') return <View style={{ alignItems: 'center', marginTop: 14, marginBottom: 6 }}><View style={{ backgroundColor: c.sunken, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}><Txt v="mono" tone="muted" style={{ textTransform: 'capitalize' }}>{item.label}</Txt></View></View>;
        const { m } = item;
        // Team view: everything sent by the business side (any agent, or the automations) sits on the right; only the customer is on the left.
        const businessSide = agent && m.sender_id !== chat?.peer_id;
        const mine = agent ? businessSide : m.sender_id === me;
        const author = agent ? (businessSide && m.sender_id !== me && !m.is_automated ? nameOf(m.sender_id) : undefined) : chat?.kind === 'group' && !mine ? nameOf(m.sender_id) : undefined;
        const target = m.reply_to_id ? byId.get(m.reply_to_id) ?? null : undefined;
        const readable = !!conv.othersReadAt && conv.othersReadAt >= m.created_at;
        return (
          <Bubble
            m={m} mine={mine} me={me} joinedOlder={item.joinedOlder} joinedNewer={item.joinedNewer} read={readable} starred={stars.has(m.id)} highlight={flash === m.id}
            showAuthor={!!author && !item.joinedOlder && !m.is_internal} author={author}
            slack={agent} slackName={agent ? (m.sender_id === chat?.peer_id ? chat?.peer_name ?? 'Cliente' : m.is_automated ? chat?.business_name ?? 'Negocio (auto)' : nameOf(m.sender_id)) : undefined} authorId={m.sender_id} authorAvatar={agent ? (m.sender_id === chat?.peer_id ? chat?.peer_avatar : conv.people[m.sender_id]?.avatar_path) : undefined} isCustomer={agent && m.sender_id === chat?.peer_id}
            replyTo={m.reply_to_id ? target : undefined} replyAuthor={target ? nameOf(target.sender_id) : undefined}
            reactions={conv.reactions.filter((x) => x.message_id === m.id)}
            onOpenActions={setActionFor} onOpenImage={setViewer} onOpenVideo={setVideo} onJumpTo={jumpTo} onReply={(x) => { setReplyTo(x); setEditing(null); }} onCallBack={call.supported && chat?.kind === 'direct' && chat.peer_id && !blocked ? (kind) => call.startCall({ id: chat.peer_id!, name: chatTitle(chat), avatar: chat.peer_avatar }, kind) : undefined}
            onRetry={(x) => guard(() => conv.retry(x))} onReact={(x, e) => guard(() => conv.react(x.id, conv.reactions.some((r) => r.message_id === x.id && r.user_id === me && r.emoji === e) ? null : e))}
          />
        );
      }}
    />
  );

  const mineAction = actionFor?.sender_id === me;
  const canEdit = mineAction && !!actionFor?.body && !actionFor.attachment_path && !actionFor.is_automated;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      <View style={{ flex: 1, backgroundColor: c.bg }}><Wallpaper />{body}</View>
      {scheduled.length > 0 && (
        <Pressy onPress={() => setSchedOpen(true)} accessibilityRole="button" accessibilityLabel="Ver mensajes programados" scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: c.accentSoft, borderTopWidth: 1, borderTopColor: c.border }}>
          <Icon name="alarm" size={16} color={c.accentSoftText} />
          <Txt v="smallStrong" style={{ color: c.accentSoftText, flex: 1 }}>{scheduled.length === 1 ? '1 mensaje programado' : t('{n} mensajes programados', { n: scheduled.length })}</Txt>
          <Icon name="chevron-up" size={16} color={c.accentSoftText} />
        </Pressy>
      )}
      {chat && (
        <Composer
          agent={agent} quickReplies={quickReplies} disabledReason={disabledReason} autoFocus={wide}
          replyTo={replyTo} replyAuthor={replyTo ? nameOf(replyTo.sender_id) : undefined} onCancelReply={() => setReplyTo(null)}
          editing={editing} onCancelEdit={() => setEditing(null)} onTyping={conv.notifyTyping}
          onSchedule={async (body, at, replyTo, internal) => { await scheduleMessage(me, { conversation_id: id, body, send_at: at.toISOString(), reply_to_id: replyTo, is_internal: internal }); loadScheduled(); }}
          onSend={(v) => guard(() => conv.send({ body: v.body, file: v.file, internal: v.internal, replyTo: v.replyTo }))}
          onEditSave={(mid, text) => { setEditing(null); guard(() => conv.edit(mid, text)); }}
        />
      )}

      <Sheet visible={!!actionFor} onClose={() => setActionFor(null)} scroll={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 6, backgroundColor: c.sunken, borderRadius: 28, paddingHorizontal: 10 }}>
          {EMOJIS.map((e, i) => <EmojiPop key={e} emoji={e} index={i} onPress={() => { const m = actionFor!; setActionFor(null); guard(() => conv.react(m.id, conv.reactions.some((r) => r.message_id === m.id && r.user_id === me && r.emoji === e) ? null : e)); }} />)}
        </View>
        <SheetRow icon="arrow-undo" label="Responder" onPress={() => { setReplyTo(actionFor); setEditing(null); setActionFor(null); }} />
        {!!actionFor?.body && <SheetRow icon="copy" label="Copiar" onPress={async () => { await Clipboard.setStringAsync(actionFor!.body!); setActionFor(null); toast.show('Copiado', 'success'); }} />}
        <SheetRow icon={stars.has(actionFor?.id ?? '') ? 'star-outline' : 'star'} label={stars.has(actionFor?.id ?? '') ? 'Quitar de destacados' : 'Destacar'} onPress={() => { const m = actionFor!; const on = !stars.has(m.id); setActionFor(null); setStars((s2) => { const n = new Set(s2); if (on) n.add(m.id); else n.delete(m.id); return n; }); guard(() => starMessage(me, m.id, on)); }} />
        {canEdit && <SheetRow icon="create" label="Editar" onPress={() => { setEditing(actionFor); setReplyTo(null); setActionFor(null); }} />}
        {mineAction && <SheetRow icon="trash" label="Eliminar para todos" tone="danger" onPress={() => { const m = actionFor!; setActionFor(null); guard(() => conv.remove(m.id), 'No se pudo eliminar.'); }} />}
      </Sheet>

      <Sheet visible={schedOpen} onClose={() => setSchedOpen(false)} title="Mensajes programados">
        {scheduled.length === 0 && <Txt tone="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>No tienes mensajes pendientes.</Txt>}
        {scheduled.map((x) => (
          <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <Icon name="alarm" size={20} tone="accent" />
            <View style={{ flex: 1 }}>
              <Txt v="smallStrong">{new Date(x.send_at).toLocaleString(loc(), { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Txt>
              <Txt v="small" tone="muted" numberOfLines={2}>{x.body}</Txt>
            </View>
            <IconButton icon="trash-outline" label="Cancelar envío" tone="danger" size={38} onPress={() => { setScheduled((cur) => cur.filter((y) => y.id !== x.id)); guard(() => cancelScheduled(x.id)); }} />
          </View>
        ))}
      </Sheet>

      <Sheet visible={statePicker} onClose={() => setStatePicker(false)} title="Estado de la conversación">
        {(Object.keys(stateMeta) as ConversationState[]).map((s) => (
          <SheetRow key={s} label={stateMeta[s].label} onPress={() => setState(s)} right={chat?.state === s ? <Icon name="checkmark-circle" tone="accent" /> : <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: stateMeta[s].color }} />} />
        ))}
      </Sheet>

      <Sheet visible={assignPicker} onClose={() => setAssignPicker(false)} title="Asignar conversación">
        <SheetRow icon="hand-right" label="Asignármela a mí" onPress={() => assign(me)} right={chat?.assigned_to === me ? <Icon name="checkmark-circle" tone="accent" /> : undefined} />
        {team.filter((t) => t.user_id !== me && t.role !== 'viewer').map((t) => <SheetRow key={t.user_id} icon="person" label={t.display_name} sub={t.role} onPress={() => assign(t.user_id)} right={chat?.assigned_to === t.user_id ? <Icon name="checkmark-circle" tone="accent" /> : undefined} />)}
        <SheetRow icon="close-circle" label="Quitar asignación" onPress={() => assign(null)} />
      </Sheet>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={chat ? chatTitle(chat) : undefined}>
        {chat && (
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 10 }}>
            <Avatar name={chatTitle(chat)} seed={chat.peer_id ?? chat.id} path={chat.peer_avatar} size={84} group={chat.kind === 'group'} business={chat.kind === 'business' && !agent} />
            {subtitle ? <Txt tone="muted">{subtitle}</Txt> : null}
            {chat.kind === 'direct' && chat.peer_id && conv.people[chat.peer_id]?.bio ? <Txt v="small" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>{conv.people[chat.peer_id]?.bio}</Txt> : null}
          </View>
        )}
        <SheetRow icon="search" label="Buscar en mensajes" onPress={() => { setMenu(false); router.push('/search'); }} />
        {chat?.kind === 'business' && !agent && chat.business_id && <SheetRow icon="storefront" label="Ver perfil y catálogo" onPress={() => { setMenu(false); router.push({ pathname: '/b/[id]', params: { id: chat.business_id! } }); }} />}
        {chat?.kind === 'direct' && chat.peer_id && (
          <SheetRow icon={blocked ? 'checkmark-circle' : 'ban'} label={blocked ? 'Desbloquear contacto' : 'Bloquear contacto'} tone={blocked ? 'accent' : 'danger'}
            onPress={() => guard(async () => { if (blocked) await unblockUser(me, chat.peer_id!); else await blockUser(me, chat.peer_id!); setBlocked(!blocked); setMenu(false); toast.show(blocked ? 'Contacto desbloqueado' : 'Contacto bloqueado', 'success'); })} />
        )}
        {chat?.kind === 'group' && <SheetRow icon="exit" label="Salir del grupo" tone="danger" onPress={() => guard(async () => { await leaveConversation(id); setMenu(false); refresh(); router.replace('/chats'); })} />}
        {chat && chat.kind !== 'business' && <SheetRow icon={chat.muted_until ? 'notifications' : 'notifications-off'} label={chat.muted_until ? 'Activar notificaciones' : 'Silenciar notificaciones'}
          onPress={() => guard(async () => { const until = chat.muted_until ? null : new Date(Date.now() + 365 * 864e5).toISOString(); const { error } = await supabase.from('conversation_members').update({ muted_until: until }).eq('conversation_id', id).eq('user_id', me); if (error) throw error; conv.setChat((x) => x && { ...x, muted_until: until }); patch(id, { muted_until: until }); setMenu(false); })} />}
      </Sheet>

      <VideoModal url={video} onClose={() => setVideo(null)} />
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }}>
          {viewer && <Image source={{ uri: viewer }} resizeMode="contain" style={{ flex: 1 }} />}
          <View style={{ position: 'absolute', top: insets.top + 10, right: 12 }}><IconButton icon="close" label="Cerrar" onPress={() => setViewer(null)} size={46} filled /></View>
        </View>
      </Modal>
    </View>
  );
}

function Notice() {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', marginVertical: 12, paddingHorizontal: 30 }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: c.accentSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
        <Icon name="lock-closed" size={12} color={c.accentSoftText} />
        <Txt v="caption" style={{ color: c.accentSoftText, textAlign: 'center' }}>Solo los participantes ven esta conversación. Cifrada en tránsito y en reposo.</Txt>
      </View>
    </View>
  );
}

function EmojiPop({ emoji, index, onPress }: { emoji: string; index: number; onPress: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.sequence([Animated.delay(index * 45), Animated.spring(v, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 14, bounciness: 18 })]).start(); }, [v, index]);
  return (
    <Pressy scale={0.7} accessibilityLabel={t('Reaccionar {emoji}', { emoji })} onPress={() => { hapticSoft(); onPress(); }} style={{ padding: 6 }}>
      <Animated.View style={{ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <Txt style={{ fontSize: 28, lineHeight: 34 }}>{emoji}</Txt>
      </Animated.View>
    </Pressy>
  );
}
