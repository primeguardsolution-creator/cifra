import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Linking, PanResponder, Platform, View } from 'react-native';
import { hapticSoft, hapticSuccess } from '../../lib/haptics';
import { Message, Reaction } from '../../lib/api';
import { bytes, messageTime } from '../../lib/format';
import { signedMediaUrl } from '../../lib/media';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Icon, Pressy, Txt } from '../../ui';
import { parseApptCard } from '../../lib/biz';
import { ApptCard } from './ApptCard';
import { VideoThumb } from './VideoPlayer';
import { VoicePlayer } from './VoicePlayer';
import { t, tr } from '../../i18n';

export type BubbleProps = {
  m: Message; mine: boolean; replyTo?: Message | null; replyAuthor?: string; author?: string; showAuthor?: boolean;
  joinedOlder: boolean; joinedNewer: boolean; read: boolean; reactions: Reaction[]; me: string;
  onOpenActions: (m: Message) => void; onOpenImage: (uri: string) => void; onOpenVideo?: (uri: string) => void; onRetry: (m: Message) => void; onJumpTo?: (id: string) => void;
  onReact: (m: Message, emoji: string) => void; starred?: boolean; highlight?: boolean; onReply?: (m: Message) => void; onCallBack?: (kind: 'audio' | 'video') => void;
  /** Business team view: Slack-style message rows instead of bubbles. */
  slack?: boolean; slackName?: string; authorId?: string; authorAvatar?: string | null; isCustomer?: boolean;
};

const urlRe = /(https?:\/\/[^\s]+)/g;

function RichText({ text, color, linkColor }: { text: string; color: string; linkColor: string }) {
  const parts = text.split(urlRe);
  return (
    <Txt style={{ color, fontSize: 16, lineHeight: 22 }}>
      {parts.map((p, i) => urlRe.test(p) || /^https?:\/\//.test(p)
        ? <Txt key={i} style={{ color: linkColor, textDecorationLine: 'underline', fontSize: 16, lineHeight: 22 }} onPress={() => Linking.openURL(p)}>{p}</Txt>
        : p)}
    </Txt>
  );
}

function Attachment({ m, mine, onOpenImage, onOpenVideo }: { m: Message; mine: boolean; onOpenImage: (uri: string) => void; onOpenVideo?: (uri: string) => void }) {
  const { c } = useTheme();
  const [url, setUrl] = useState<string | null>(m.localUri ?? null);
  const isImage = m.attachment_type?.startsWith('image/');
  const isVideo = m.attachment_type?.startsWith('video/');
  useEffect(() => {
    let live = true;
    if (m.attachment_path && !m.localUri) signedMediaUrl(m.attachment_path).then((u) => live && setUrl(u));
    else if (m.localUri) setUrl(m.localUri);
    return () => { live = false; };
  }, [m.attachment_path, m.localUri]);

  if (m.attachment_type?.startsWith('audio/')) return <View style={{ marginBottom: m.body ? 6 : 0 }}><VoicePlayer m={m} mine={mine} /></View>;
  if (isImage) {
    return (
      <Pressy onPress={() => url && onOpenImage(url)} scale={0.98} accessibilityRole="imagebutton" accessibilityLabel="Abrir foto" style={{ borderRadius: 14, overflow: 'hidden', width: 260, height: 260, backgroundColor: c.sunken, marginBottom: m.body ? 6 : 0 }}>
        {url ? <Image source={{ uri: url }} style={{ width: 260, height: 260 }} resizeMode="cover" /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>}
        {m.pending && <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' } as object}><ActivityIndicator color="#fff" /></View>}
      </Pressy>
    );
  }
  if (isVideo) return <View style={{ marginBottom: m.body ? 6 : 0 }}><VideoThumb url={url} pending={m.pending} onOpen={() => url && (onOpenVideo ? onOpenVideo(url) : Linking.openURL(url))} /></View>;
  const fg = mine ? c.bubbleOutText : c.bubbleInText;
  return (
    <Pressy onPress={() => url && Linking.openURL(url)} scale={0.98} accessibilityRole="link" accessibilityLabel={t('Abrir {name}', { name: m.attachment_name ?? tr('archivo') })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: mine ? 'rgba(255,255,255,0.12)' : c.surfaceAlt, minWidth: 220, marginBottom: m.body ? 6 : 0 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        {m.pending ? <ActivityIndicator color={c.accent} /> : <Icon name={isVideo ? 'play' : 'document-text'} size={20} color={c.accentSoftText} />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="smallStrong" numberOfLines={1} style={{ color: fg }}>{m.attachment_name ?? (isVideo ? 'Vídeo' : 'Archivo')}</Txt>
        <Txt v="caption" style={{ color: mine ? c.bubbleOutMeta : c.textMuted }}>{[isVideo ? 'Vídeo' : 'Documento', bytes(m.attachment_size)].filter(Boolean).join(' · ')}</Txt>
      </View>
    </Pressy>
  );
}

function BubbleBase(p: BubbleProps) {
  const { c, space } = useTheme();
  const { m, mine } = p;
  const [hover, setHover] = useState(false);
  const native = Platform.OS !== 'web';
  const latest = useRef(p); latest.current = p;
  const dx = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(Date.now() - new Date(m.created_at).getTime() < 4000 ? 0 : 1)).current;
  const lastTap = useRef(0);
  useEffect(() => { if ((enter as unknown as { _value: number })._value < 1) Animated.spring(enter, { toValue: 1, useNativeDriver: native, speed: 16, bounciness: 9 }).start(); }, [enter, native]);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx > 14 && g.dx > Math.abs(g.dy) * 2 && !latest.current.m.deleted_at && !latest.current.m.pending,
    onPanResponderMove: (_, g) => dx.setValue(Math.min(84, g.dx * 0.6)),
    onPanResponderRelease: (_, g) => {
      if (g.dx * 0.6 > 38) { hapticSoft(); latest.current.onReply?.(latest.current.m); }
      Animated.spring(dx, { toValue: 0, useNativeDriver: native, speed: 20, bounciness: 8 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(dx, { toValue: 0, useNativeDriver: native }).start(),
  })).current;
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 320 && !latest.current.m.deleted_at && !latest.current.m.pending) {
      lastTap.current = 0; hapticSuccess();
      if (!latest.current.reactions.some((r) => r.user_id === latest.current.me && r.emoji === '❤️')) latest.current.onReact(latest.current.m, '❤️');
      heart.setValue(0); Animated.sequence([Animated.timing(heart, { toValue: 1, duration: 200, easing: Easing.out(Easing.back(2.2)), useNativeDriver: native }), Animated.delay(320), Animated.timing(heart, { toValue: 0, duration: 200, useNativeDriver: native })]).start();
    } else lastTap.current = now;
  };
  const deleted = !!m.deleted_at;
  const internal = m.is_internal;
  const bg = internal ? c.internal : mine ? c.bubbleOut : c.bubbleIn;
  const fg = internal ? c.text : mine ? c.bubbleOutText : c.bubbleInText;
  const meta = internal ? c.textMuted : mine ? c.bubbleOutMeta : c.textFaint;
  const R = 20; const r = 6;
  const radius = {
    borderTopLeftRadius: !mine && p.joinedOlder ? r : R, borderTopRightRadius: mine && p.joinedOlder ? r : R,
    borderBottomLeftRadius: mine ? R : r, borderBottomRightRadius: mine ? r : R,
  };
  const grouped = Object.entries(p.reactions.reduce<Record<string, Reaction[]>>((acc, x) => { (acc[x.emoji] ??= []).push(x); return acc; }, {}));

  if (p.slack) {
    const name = p.slackName ?? (mine ? 'Tú' : 'Cliente');
    const first = !p.joinedOlder;
    return (
      <Animated.View {...pan.panHandlers} {...(Platform.OS === 'web' ? ({ onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) } as object) : {})}
        style={{ flexDirection: 'row', gap: 11, paddingHorizontal: 14, paddingTop: first ? 10 : 1, paddingBottom: 1, backgroundColor: p.highlight ? c.accentSoft : hover ? c.surfaceAlt : 'transparent', opacity: enter, transform: [{ translateX: dx }, { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <View style={{ width: 36, alignItems: 'center', paddingTop: first ? 2 : 4 }}>
          {first ? <Avatar name={name} seed={p.authorId ?? name} path={p.authorAvatar} size={36} /> : hover ? <Txt style={{ fontFamily: 'GeistMono_500Medium', fontSize: 9, color: c.textFaint }}>{messageTime(m.created_at)}</Txt> : null}
        </View>
        <Pressy onPress={onTap} onLongPress={() => !deleted && !m.pending && p.onOpenActions(m)} delayLongPress={320} scale={1}
          {...(Platform.OS === 'web' ? ({ onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); if (!deleted && !m.pending) p.onOpenActions(m); } } as object) : {})}
          accessibilityLabel={`${name}: ${m.body ?? 'adjunto'}`} style={{ flex: 1, paddingVertical: 2, opacity: m.pending ? 0.6 : 1 }}>
          {first && (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <Txt style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, lineHeight: 20, color: p.isCustomer ? c.text : c.highlight }}>{name}</Txt>
              {p.isCustomer && <View style={{ paddingHorizontal: 5, height: 16, borderRadius: 3, backgroundColor: c.sunken, justifyContent: 'center' }}><Txt style={{ fontFamily: 'GeistMono_500Medium', fontSize: 9, color: c.textMuted }}>CLIENTE</Txt></View>}
              <Txt v="mono" tone="faint">{messageTime(m.created_at)}</Txt>
              {m.edited_at && !deleted && <Txt v="caption" tone="faint">(editado)</Txt>}
              {m.is_automated && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Icon name="flash" size={10} color={c.highlight} /><Txt v="mono" tone="faint">AUTOMÁTICO</Txt></View>}
            </View>
          )}
          <View style={internal ? { borderLeftWidth: 3, borderLeftColor: c.internalBorder, backgroundColor: c.internal, paddingHorizontal: 10, paddingVertical: 6, marginTop: 2, borderRadius: 3 } : undefined}>
            {internal && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}><Icon name="lock-closed" size={11} tone="muted" /><Txt v="mono" tone="muted">NOTA INTERNA · SOLO EL EQUIPO</Txt></View>}
            {p.replyTo !== undefined && m.reply_to_id && (
              <Pressy onPress={() => p.onJumpTo?.(m.reply_to_id!)} scale={0.99} style={{ borderLeftWidth: 3, borderLeftColor: c.borderStrong, paddingLeft: 8, marginBottom: 4 }}>
                <Txt v="caption" style={{ color: c.highlight }} numberOfLines={1}>{p.replyAuthor ?? 'Mensaje'}</Txt>
                <Txt v="small" tone="muted" numberOfLines={2}>{p.replyTo ? (p.replyTo.deleted_at ? 'Mensaje eliminado' : p.replyTo.body ?? 'Adjunto') : 'Mensaje anterior'}</Txt>
              </Pressy>
            )}
            {deleted ? <Txt v="small" tone="faint" style={{ fontStyle: 'italic' }}>Mensaje eliminado</Txt> : (
              <>
                {m.attachment_type && (m.attachment_path || m.localUri) && <Attachment m={m} mine={false} onOpenImage={p.onOpenImage} onOpenVideo={p.onOpenVideo} />}
                {m.body && parseApptCard(m.body) ? <ApptCard body={m.body} mine={false} team /> : m.body ? <RichText text={m.body} color={c.text} linkColor={c.highlight} /> : null}
              </>
            )}
          </View>
          {m.failed && <Pressy onPress={() => p.onRetry(m)} accessibilityRole="button" style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 }}><Icon name="refresh" size={13} tone="danger" /><Txt v="caption" tone="danger">No se envió · reintentar</Txt></Pressy>}
          {grouped.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
              {grouped.map(([emoji, list]) => {
                const mineReact = list.some((x) => x.user_id === p.me);
                return (
                  <Pressy key={emoji} onPress={() => p.onReact(m, emoji)} scale={0.92} accessibilityLabel={t('Reacción {emoji}, {n}', { emoji, n: list.length })} style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 7, height: 24, borderRadius: 5, backgroundColor: mineReact ? c.accentSoft : c.sunken, borderWidth: 1, borderColor: mineReact ? c.highlight : c.border }}>
                    <Txt style={{ fontSize: 13, lineHeight: 17 }}>{emoji}</Txt><Txt v="caption" tone="muted">{list.length}</Txt>
                  </Pressy>
                );
              })}
            </View>
          )}
          {p.starred && <Icon name="star" size={11} color={c.warning} />}
        </Pressy>
        {Platform.OS === 'web' && hover && !deleted && !m.pending && (
          <Pressy onPress={() => p.onOpenActions(m)} accessibilityRole="button" accessibilityLabel="Opciones del mensaje" scale={0.9} style={{ position: 'absolute', right: 12, top: 4, width: 28, height: 26, borderRadius: 5, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ellipsis-horizontal" size={15} tone="muted" />
          </Pressy>
        )}
      </Animated.View>
    );
  }

  return (
    <Animated.View {...pan.panHandlers} {...(Platform.OS === 'web' ? ({ onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) } as object) : {})} style={{ paddingHorizontal: 12, marginTop: p.joinedOlder ? 2 : 10, alignItems: mine ? 'flex-end' : 'flex-start', opacity: enter, transform: [{ translateX: dx }, { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -2, top: '50%', marginTop: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', opacity: dx.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ scale: dx.interpolate({ inputRange: [0, 40], outputRange: [0.4, 1], extrapolate: 'clamp' }) }, { translateX: -34 }] }}>
        <Icon name="arrow-undo" size={17} color={c.accentSoftText} />
      </Animated.View>
      <View style={{ maxWidth: '82%', flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
        <Pressy
          onPress={onTap} onLongPress={() => !deleted && !m.pending && p.onOpenActions(m)} delayLongPress={320} scale={0.99}
          {...(Platform.OS === 'web' ? ({ onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); if (!deleted && !m.pending) p.onOpenActions(m); } } as object) : {})}
          accessibilityLabel={`${mine ? 'Tú' : p.author ?? 'Mensaje'}: ${m.body ?? 'adjunto'}`} accessibilityHint="Mantén pulsado para ver opciones"
          style={[{ backgroundColor: deleted ? 'transparent' : bg, ...(mine && !internal && !deleted && space === 'personal' && Platform.OS === 'web' ? ({ backgroundImage: `linear-gradient(135deg, ${c.bubbleOut} 0%, ${c.bubbleOut} 45%, ${c.highlight} 190%)` } as object) : {}), ...(p.highlight ? { shadowColor: c.highlight, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, borderWidth: 2, borderColor: c.highlight } : {}), paddingHorizontal: 13, paddingTop: 8, paddingBottom: 7, flexShrink: 1, borderWidth: deleted || internal ? 1 : mine ? 0 : 1, borderColor: internal ? c.internalBorder : c.border, borderStyle: deleted || internal ? 'dashed' : 'solid', opacity: m.pending ? 0.75 : 1 }, radius]}
        >
          {internal && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}><Icon name="lock-closed" size={11} tone="muted" /><Txt v="mono" tone="muted">NOTA INTERNA{p.author ? ` · ${p.author}` : ''}</Txt></View>}
          {m.is_automated && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}><Icon name="flash" size={11} color={mine ? c.bubbleOutMeta : c.highlight} /><Txt v="mono" style={{ color: meta }}>RESPUESTA AUTOMÁTICA</Txt></View>}
          {p.showAuthor && p.author && !internal && <Txt v="smallStrong" style={{ color: c.highlight, marginBottom: 2 }}>{p.author}</Txt>}
          {p.replyTo !== undefined && m.reply_to_id && (
            <Pressy onPress={() => p.onJumpTo?.(m.reply_to_id!)} scale={0.99} style={{ borderLeftWidth: 3, borderLeftColor: c.highlight, backgroundColor: mine ? 'rgba(255,255,255,0.12)' : c.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 }}>
              <Txt v="caption" style={{ color: c.highlight }} numberOfLines={1}>{p.replyAuthor ?? 'Mensaje'}</Txt>
              <Txt v="small" numberOfLines={2} style={{ color: mine ? c.bubbleOutMeta : c.textMuted }}>{p.replyTo ? (p.replyTo.deleted_at ? 'Mensaje eliminado' : p.replyTo.body ?? (p.replyTo.attachment_type?.startsWith('image') ? '📷 Foto' : '📎 Archivo')) : 'Mensaje anterior'}</Txt>
            </Pressy>
          )}
          {deleted ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="ban" size={14} tone="faint" /><Txt v="small" tone="faint" style={{ fontStyle: 'italic' }}>Mensaje eliminado</Txt></View>
          ) : (
            <>
              {m.attachment_type && (m.attachment_path || m.localUri) && <Attachment m={m} mine={mine} onOpenImage={p.onOpenImage} onOpenVideo={p.onOpenVideo} />}
              {m.body && parseApptCard(m.body) ? <ApptCard body={m.body} mine={mine} team={!!p.slack} /> : m.body && /^[📞📹]/u.test(m.body) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 210, paddingVertical: 2 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: /sin respuesta/.test(m.body) && !mine ? c.dangerSoft : mine ? 'rgba(255,255,255,0.16)' : c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={m.body.startsWith('📹') ? 'videocam' : 'call'} size={19} color={/sin respuesta/.test(m.body) && !mine ? c.danger : mine ? c.bubbleOutText : c.accentSoftText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong" style={{ color: /sin respuesta/.test(m.body) && !mine ? c.danger : fg }}>{m.body.replace(/^[📞📹]\s*/u, '').split(' · ')[0].replace('sin respuesta', '').trim()}{/sin respuesta/.test(m.body) ? (mine ? ' · Sin respuesta' : ' · Perdida') : ''}</Txt>
                    <Txt v="caption" style={{ color: mine ? c.bubbleOutMeta : c.textMuted }}>{m.body.match(/·\s*([0-9]+:[0-9]{2})/)?.[1] ? t('Duración {d}', { d: m.body.match(/·\s*([0-9]+:[0-9]{2})/)?.[1] ?? '' }) : mine ? 'No contestó' : 'No pudiste atenderla'}</Txt>
                  </View>
                  {p.onCallBack && <Pressy onPress={() => p.onCallBack!(m.body!.startsWith('📹') ? 'video' : 'audio')} accessibilityRole="button" accessibilityLabel="Devolver la llamada" scale={0.9} style={{ paddingHorizontal: 11, height: 30, borderRadius: 15, backgroundColor: mine ? 'rgba(255,255,255,0.18)' : c.accent, justifyContent: 'center' }}><Txt v="caption" style={{ color: mine ? c.bubbleOutText : c.accentText, fontFamily: 'Inter_600SemiBold' }}>{mine ? 'Repetir' : 'Devolver'}</Txt></Pressy>}
                </View>
              ) : m.body ? <RichText text={m.body} color={fg} linkColor={mine ? '#BFF0DD' : c.accent} /> : null}
            </>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
            {p.starred && <Icon name="star" size={11} color={mine ? '#F6D77A' : c.warning} />}
            {m.edited_at && !deleted && <Txt v="caption" style={{ color: meta, fontSize: 11 }}>editado</Txt>}
            <Txt v="mono" style={{ color: meta, fontSize: 10 }}>{messageTime(m.created_at)}</Txt>
            {mine && !deleted && !internal && (m.pending ? <Icon name="time-outline" size={13} color={meta} /> : m.failed ? <Icon name="alert-circle" size={14} color={c.danger} /> : <Icon name={p.read ? 'checkmark-done' : 'checkmark'} size={15} color={p.read ? '#7CF0C4' : meta} />)}
          </View>
        </Pressy>
        {Platform.OS === 'web' && hover && !deleted && !m.pending && (
          <Pressy onPress={() => p.onOpenActions(m)} accessibilityRole="button" accessibilityLabel="Opciones del mensaje" scale={0.9} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron-down" size={15} tone="muted" />
          </Pressy>
        )}
      </View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: '30%', opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.5] }) }] }}>
        <Icon name="heart" size={54} color="#FF4D6D" />
      </Animated.View>
      {m.failed && (
        <Pressy onPress={() => p.onRetry(m)} accessibilityRole="button" style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4, marginRight: 4 }}>
          <Icon name="refresh" size={14} tone="danger" /><Txt v="caption" tone="danger">No se envió · Toca para reintentar</Txt>
        </Pressy>
      )}
      {grouped.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: -4, marginHorizontal: 10, zIndex: 1 }}>
          {grouped.map(([emoji, list]) => {
            const mineReact = list.some((x) => x.user_id === p.me);
            return (
              <Pressy key={emoji} onPress={() => p.onReact(m, emoji)} scale={0.92} accessibilityLabel={t('Reacción {emoji}, {n}', { emoji, n: list.length })} style={{ flexDirection: 'row', gap: 3, alignItems: 'center', paddingHorizontal: 7, height: 24, borderRadius: 12, backgroundColor: mineReact ? c.accentSoft : c.surface, borderWidth: 1, borderColor: mineReact ? c.accent : c.border }}>
                <Txt style={{ fontSize: 13, lineHeight: 17 }}>{emoji}</Txt>{list.length > 1 && <Txt v="caption" tone="muted">{list.length}</Txt>}
              </Pressy>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

export const Bubble = memo(BubbleBase);
