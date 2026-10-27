import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { recentSpaceSwitch, setSharedAvatar, useReducedMotion } from '../lib/motion';
import { useChats } from '../state/ChatsProvider';
import { Chat, ConversationState } from '../lib/api';
import { listTime } from '../lib/format';
import { formatPhone } from '../lib/phone';
import { useAuth } from '../state/AuthProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar, Badge, Icon, Pressy, Txt } from '../ui';
import { t, tr } from '../i18n';


const nat = Platform.OS !== 'web';
/** Glow already played for this message (a row that remounts while scrolling must not replay it). */
const glowPlayed = new Set<string>();

export const stateMeta: Record<ConversationState, { label: string; color: string }> = {
  open: { label: 'Abierto', color: '#1FA67A' },
  pending: { label: 'Pendiente', color: '#D9A64B' },
  resolved: { label: 'Resuelto', color: '#7A8A84' },
  closed: { label: 'Cerrado', color: '#98A09B' },
};

export function chatTitle(c: Chat) {
  return c.peer_name || c.title || (c.peer_phone ? formatPhone(c.peer_phone) : 'Conversación');
}

/** "2 h 41 min" left before an incognito room self-destructs (null when it has no timer). */
export function incognitoLeft(c: Pick<Chat, 'incognito' | 'expires_at'>): string | null {
  if (!c.incognito || !c.expires_at) return null;
  const ms = new Date(c.expires_at).getTime() - Date.now();
  if (ms <= 0) return tr('caducado');
  const h = Math.floor(ms / 3600e3); const m = Math.max(1, Math.floor((ms % 3600e3) / 60e3));
  return h > 0 ? t('{h} h {m} min', { h, m }) : t('{m} min', { m });
}

/** Chats where the last message needs its author: groups, and business chats (the customer sees which team member wrote). */
export const showsAuthor = (c: Chat, me?: string) => !!c.last_message_id && !c.last_deleted && !c.incognito && c.last_sender !== me && !c.last_internal && !!c.last_sender_name && (c.kind === 'group' || (c.kind === 'business' && c.perspective === 'personal'));

export function previewText(c: Chat, me?: string) {
  if (c.last_message_id == null) return tr(c.kind === 'business' && c.perspective === 'personal' ? 'Escribe tu primer mensaje' : 'Di hola 👋');
  if (c.last_deleted) return tr('Mensaje eliminado');
  const t0 = c.last_attachment_type;
  const base = c.last_body?.trim() || tr(t0?.startsWith('image') ? '📷 Foto' : t0?.startsWith('video') ? '🎬 Vídeo' : t0?.startsWith('audio') ? '🎤 Mensaje de voz' : '📎 Archivo');
  const prefix = c.last_internal ? tr('Nota interna: ') : c.last_sender === me ? tr('Tú: ') : '';
  return prefix + base;
}

export function ChatRow({ chat, selected, showState, onMenu, typing, index = 0 }: { index?: number; chat: Chat; selected?: boolean; showState?: boolean; onMenu?: (c: Chat) => void; typing?: boolean }) {
  const { c, space } = useTheme();
  const { user } = useAuth();
  const biz = space === 'business';
  const muted = chat.muted_until && new Date(chat.muted_until) > new Date();
  const hasUnread = chat.unread > 0 || chat.marked_unread;
  const agentView = chat.perspective === 'agent';
  const st = stateMeta[chat.state];
  const { newContacts } = useChats();
  const reduced = useReducedMotion();
  const newAt = newContacts[chat.id];
  const isNew = !!newAt;
  const glow = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [rowW, setRowW] = useState(0);
  // Someone not in my contacts just wrote: one soft lilac pulse around the whole card, then back to normal.
  useEffect(() => {
    if (!newAt || reduced) return;
    const k = `${chat.id}:${newAt}`;
    if (glowPlayed.has(k) || Date.now() - newAt > 4000) return;
    glowPlayed.add(k);
    glow.setValue(0); sweep.setValue(0);
    Animated.parallel([
      Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: nat }), Animated.delay(900), Animated.timing(glow, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: nat })]),
      Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: nat }),
    ]).start();
  }, [newAt, reduced, chat.id, glow, sweep]);
  // First paint after Personal ⇄ Business: the rows slide in from the side the new space lives on. Scrolling never triggers it.
  const enterRef = useRef(!reduced ? recentSpaceSwitch() : null);
  const enter = useRef(new Animated.Value(enterRef.current ? 0 : 1)).current;
  useEffect(() => { if (enterRef.current) Animated.timing(enter, { toValue: 1, duration: 300, delay: 120 + Math.min(index, 7) * 45, easing: Easing.out(Easing.cubic), useNativeDriver: nat }).start(); }, [enter, index]);
  const avatarRef = useRef<View>(null);
  const open = () => {
    if (!reduced) avatarRef.current?.measureInWindow?.((x, y, w) => { if (w > 0) setSharedAvatar(chat.id, x, y, w); });
    router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
  };
  return (
    <Animated.View onLayout={(e) => setRowW(e.nativeEvent.layout.width)} style={{ opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [(enterRef.current?.dir ?? 0) * 24, 0] }) }] }}>
    {isNew && !reduced && (
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 6, right: 6, top: 2, bottom: 2, borderRadius: 16, overflow: 'hidden', opacity: glow, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.accentSoft, shadowColor: c.accent, shadowOpacity: 0.45, shadowRadius: 14 }}>
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: 140, transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-140, Math.max(rowW, 320)] }) }] }}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      </Animated.View>
    )}
    <Pressy
      onPress={open} onLongPress={() => onMenu?.(chat)} delayLongPress={380} scale={0.985} hoverStyle={{ backgroundColor: c.surfaceAlt }}
      {...(Platform.OS === 'web' && onMenu ? ({ onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); onMenu(chat); } } as object) : {})}
      accessibilityRole="button" accessibilityLabel={`${chatTitle(chat)}. ${isNew ? t('Contacto nuevo') + '. ' : ''}${previewText(chat, user?.id)}. ${hasUnread ? t('{n} sin leer', { n: chat.unread }) : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: biz ? 12 : 14, paddingHorizontal: 16, paddingVertical: biz ? 9 : 12, backgroundColor: selected ? c.accentSoft : 'transparent', borderBottomWidth: biz ? 1 : 0, borderBottomColor: c.border }}
    >
      {biz && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: selected ? c.highlight : st.color }} />}
      <View ref={avatarRef} collapsable={false}><Avatar name={chatTitle(chat)} seed={chat.peer_id ?? chat.id} path={chat.peer_avatar} size={biz ? 42 : 52} group={chat.kind === 'group'} business={chat.kind === 'business' && !agentView} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {chat.incognito && <Icon name="glasses" size={16} tone="muted" />}
          <Txt v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1, fontFamily: chat.incognito ? 'SpecialElite_400Regular' : hasUnread ? 'Inter_700Bold' : 'Inter_600SemiBold' }}>{chatTitle(chat)}</Txt>
          {isNew && <View style={{ paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, justifyContent: 'center' }}><Txt v="caption" style={{ color: c.accentSoftText, fontFamily: 'Inter_600SemiBold' }}>{t('Contacto nuevo')}</Txt></View>}
          <View style={{ flex: 1 }} />
          {chat.incognito && incognitoLeft(chat) && <Txt v="mono" tone="faint">⏳ {incognitoLeft(chat)}</Txt>}
          {chat.pinned_at && <Icon name="pin" size={12} tone="faint" />}
          <Txt v="mono" tone={hasUnread ? 'accent' : 'faint'}>{listTime(chat.last_at ?? chat.created_at)}</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {chat.last_sender === user?.id && !chat.last_deleted && chat.last_message_id ? <Icon name={chat.last_delivered || chat.last_read ? 'checkmark-done' : 'checkmark'} size={16} color={chat.last_read ? c.success : c.textFaint} /> : null}
          {showsAuthor(chat, user?.id) && <Avatar name={chat.last_sender_name} seed={chat.last_sender ?? chat.id} path={chat.last_sender_avatar} size={18} />}
          <Txt v="small" tone={hasUnread ? 'text' : 'muted'} numberOfLines={1} style={{ flex: 1, fontStyle: chat.last_deleted ? 'italic' : 'normal', fontFamily: hasUnread ? 'Inter_500Medium' : 'Inter_400Regular' }}>{showsAuthor(chat, user?.id) ? `${chat.last_sender_name}: ` : ''}{previewText(chat, user?.id)}</Txt>
          {muted && <Icon name="notifications-off" size={14} tone="faint" />}
          {chat.unread > 0 ? <Badge count={chat.unread} tone={muted ? 'muted' : 'new'} /> : chat.marked_unread ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.success }} accessibilityLabel="Marcado como no leído" /> : null}
        </View>
        {(showState || (chat.kind === 'business' && !agentView)) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
            {showState && <><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color }} /><Txt v="caption" tone="muted">{st.label}{chat.assigned_to ? chat.assigned_to === user?.id ? ' · Asignado a ti' : ' · Asignado' : ' · Sin asignar'}</Txt></>}
            {chat.kind === 'business' && !agentView && <><Icon name="storefront" size={12} tone="accent" /><Txt v="caption" tone="accent">Negocio</Txt></>}
          </View>
        )}
      </View>
    </Pressy>
    </Animated.View>
  );
}
