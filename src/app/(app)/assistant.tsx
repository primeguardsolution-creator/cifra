import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, NativeSyntheticEvent, Platform, TextInput, TextInputKeyPressEventData, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wallpaper } from '../../components/Wallpaper';
import { aiMaybeAvailable, askClaude } from '../../features/assistant/ai';
import { BotAvatar } from '../../features/assistant/BotAvatar';
import { Chip as ChipT, commandList, commandSuggestions, greeting, respond, topicReply } from '../../features/assistant/engine';
import { BOT, BotAction } from '../../features/assistant/knowledge';
import { RichBot } from '../../features/assistant/RichBot';
import { BotMsg, assistantStore, useAssistantState } from '../../features/assistant/store';
import { hapticSoft, hapticTap } from '../../lib/haptics';
import { WIDE } from '../../lib/layout';
import { appUrl, inviteMessage, shareText } from '../../lib/share';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { font } from '../../theme/tokens';
import { Icon, IconButton, IconName, Pressy, Sheet, SheetRow, Txt, TypingDots, useToast } from '../../ui';
import { getLocale, tr } from '../../i18n';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Assistant() {
  const { c, space } = useTheme();
  const { user, profile } = useAuth();
  const { switchSpace } = useSpace();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const st = useAssistantState();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const input = useRef<TextInput>(null);
  const welcomed = useRef(false);
  const name = profile?.display_name;

  useEffect(() => { if (user) assistantStore.load(user.id); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (st.loaded) assistantStore.markSeen(); }, [st.loaded, st.msgs.length]);

  const reply = useCallback(async (build: () => Promise<{ text: string; actions?: BotAction[]; chips?: ChipT[]; menu?: BotMsg['menu']; ai?: boolean }>, minMs: number) => {
    setBusy(true);
    const started = Date.now();
    const r = await build();
    await sleep(Math.max(0, minMs - (Date.now() - started)));
    assistantStore.add({ from: 'bot', text: r.text, actions: r.actions, chips: r.chips, menu: r.menu, ai: r.ai });
    hapticSoft();
    setBusy(false);
  }, []);

  // Welcome message, the first time this user opens the assistant.
  useEffect(() => {
    if (!st.loaded || st.msgs.length > 0 || welcomed.current) return;
    welcomed.current = true;
    reply(async () => greeting(name, getLocale()), 700);
  }, [st.loaded, st.msgs.length, name, reply]);

  const ask = useCallback(async (raw: string, topic?: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    setText('');
    assistantStore.add({ from: 'me', text: q });
    hapticTap();
    const local = topic ? topicReply(topic, 'high', '', getLocale()) : respond(q, name, getLocale());
    const delay = 420 + Math.min(900, local.text.length * 2.2);
    await reply(async () => {
      if (!topic && local.confidence === 'none' && aiMaybeAvailable()) {
        const history = assistantStore.get().msgs.filter((m) => m.text).slice(-10).map((m) => ({ role: m.from === 'me' ? ('user' as const) : ('assistant' as const), content: m.text }));
        const ai = await askClaude(history, getLocale());
        if (ai) return { text: ai, ai: true, chips: [{ label: 'Ver todos los temas', text: '/ayuda' }] };
      }
      return local;
    }, delay);
  }, [busy, name, reply]);

  const onChip = (chip: ChipT) => {
    if (chip.topic) ask(chip.label, chip.topic);
    else if (chip.text) ask(chip.text);
  };

  const runAction = async (a: BotAction) => {
    hapticTap();
    const d = a.do;
    if ('go' in d) return router.push(d.go as never);
    if ('share' in d) { toast.show((await shareText(inviteMessage, appUrl())) === 'copied' ? 'Invitación copiada' : 'Invitación enviada', 'success'); return; }
    if (space !== d.space) {
      switchSpace(d.space);
      if (a.then) setTimeout(() => router.replace(a.then as never), 560);
    } else router.replace((a.then ?? (d.space === 'business' ? '/inbox' : '/chats')) as never);
  };

  const onKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const ev = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) { (e as unknown as { preventDefault: () => void }).preventDefault(); ask(text); setTimeout(() => input.current?.focus(), 0); }
  };

  const data = useMemo(() => [...st.msgs].reverse(), [st.msgs]);
  const lastBotId = useMemo(() => [...st.msgs].reverse().find((m) => m.from === 'bot')?.id, [st.msgs]);
  const suggestions = text.startsWith('/') ? commandSuggestions(text.trim(), getLocale()) : [];
  const canSend = !!text.trim() && !busy;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 6, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 8, minHeight: 56 }}>
          {!wide && <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} />}
          <Pressy onPress={() => setMore(true)} accessibilityRole="button" accessibilityLabel="Acerca de Maestro CIFRA" scale={0.99} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: wide ? 10 : 2 }}>
            <BotAvatar size={42} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Txt v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{BOT.name}</Txt>
                <Icon name="checkmark-circle" size={16} tone="accent" />
              </View>
              {busy ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><TypingDots size={4} /><Txt v="caption" tone="accent">escribiendo</Txt></View> : <Txt v="caption" tone="muted" numberOfLines={1}>bot oficial · @{BOT.username}</Txt>}
            </View>
          </Pressy>
          <IconButton icon="ellipsis-horizontal" label="Más opciones" onPress={() => setMore(true)} />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Wallpaper />
        <FlatList
          data={data} inverted keyExtractor={(m) => m.id} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: 12 }}
          ListHeaderComponent={busy ? <TypingBubble /> : null}
          ListFooterComponent={<Intro />}
          renderItem={({ item, index }) => (
            <MsgBubble space={space} m={item} showOffers={item.id === lastBotId && !busy} joinedOlder={data[index + 1]?.from === item.from} onChip={onChip} onAction={runAction} />
          )}
        />
      </View>

      {suggestions.length > 0 && (
        <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, paddingVertical: 6 }}>
          {suggestions.slice(0, 5).map((s) => (
            <Pressy key={s.cmd} onPress={() => ask(s.cmd)} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} accessibilityRole="button" accessibilityLabel={`${s.cmd}: ${s.hint}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 9 }}>
              <Txt v="bodyStrong" tone="accent">{s.cmd}</Txt><Txt v="small" tone="muted" style={{ flex: 1 }}>{s.hint}</Txt>
            </Pressy>
          ))}
        </View>
      )}

      <View style={{ backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Pressy onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Menú de temas y comandos" scale={0.92} style={{ height: 46, paddingHorizontal: 14, borderRadius: 23, backgroundColor: c.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="grid" size={17} color={c.accentSoftText} /><Txt v="smallStrong" style={{ color: c.accentSoftText }}>Menú</Txt>
        </Pressy>
        <View style={{ flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 23, backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 16, justifyContent: 'center' }}>
          <TextInput
            ref={input} value={text} onChangeText={setText} onKeyPress={onKey} multiline autoFocus={wide} maxLength={500}
            placeholder={tr('Pregúntame cómo se hace algo…')} placeholderTextColor={c.textFaint} selectionColor={c.accent} accessibilityLabel={tr('Mensaje para Maestro CIFRA')}
            style={{ color: c.text, fontFamily: font.regular, fontSize: 16, lineHeight: 22, paddingVertical: 0, marginVertical: 11, outlineStyle: 'none' } as object}
          />
        </View>
        <Pressy onPress={() => ask(text)} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Enviar" scale={0.9} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: canSend ? c.accent : c.sunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-up" size={22} color={canSend ? c.accentText : c.textFaint} />
        </Pressy>
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="¿En qué te ayudo?">
        {commandList(getLocale()).map((cm) => <SheetRow key={cm.cmd} icon="chatbubble-ellipses-outline" label={cm.hint} sub={cm.cmd} onPress={() => { setMenu(false); ask(cm.cmd); }} />)}
      </Sheet>

      <Sheet visible={more} onClose={() => setMore(false)}>
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 10 }}>
          <BotAvatar size={84} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Txt v="h2">{BOT.name}</Txt><Icon name="checkmark-circle" size={20} tone="accent" /></View>
          <Txt tone="muted">@{BOT.username} · bot oficial de CIFRA</Txt>
          <Txt v="small" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>Conozco toda la app y te explico paso a paso cómo hacer cada cosa. No leo tus chats: solo veo lo que me escribes aquí.</Txt>
        </View>
        <SheetRow icon="list" label="Ver todos los temas" onPress={() => { setMore(false); ask('/ayuda'); }} />
        <SheetRow icon="trash" label="Borrar esta conversación" tone="danger" onPress={() => { setMore(false); welcomed.current = false; assistantStore.clear(); }} />
      </Sheet>
    </View>
  );
}

function Intro() {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', marginVertical: 14, paddingHorizontal: 28, gap: 10 }}>
      <BotAvatar size={64} />
      <Txt v="h3" style={{ textAlign: 'center' }}>{BOT.name}</Txt>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: c.accentSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 }}>
        <Icon name="sparkles" size={12} color={c.accentSoftText} />
        <Txt v="caption" style={{ color: c.accentSoftText, textAlign: 'center' }}>Asistente oficial · responde al instante · sabe todo de CIFRA</Txt>
      </View>
    </View>
  );
}

function TypingBubble() {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 12, marginTop: 10, alignItems: 'flex-start' }}>
      <View style={{ backgroundColor: c.bubbleIn, borderWidth: 1, borderColor: c.border, borderRadius: 20, borderBottomLeftRadius: 6, paddingHorizontal: 16, paddingVertical: 14 }}><TypingDots size={6} /></View>
    </View>
  );
}

function MsgBubble({ space, m, showOffers, joinedOlder, onChip, onAction }: { space: string; m: BotMsg; showOffers: boolean; joinedOlder: boolean; onChip: (c: ChipT) => void; onAction: (a: BotAction) => void }) {
  const { c } = useTheme();
  const mine = m.from === 'me';
  const native = Platform.OS !== 'web';
  const enter = useRef(new Animated.Value(Date.now() - new Date(m.at).getTime() < 3000 ? 0 : 1)).current;
  useEffect(() => { if ((enter as unknown as { _value: number })._value < 1) Animated.spring(enter, { toValue: 1, useNativeDriver: native, speed: 16, bounciness: 9 }).start(); }, [enter, native]);
  const R = 20; const r = 6;
  const fg = mine ? c.bubbleOutText : c.bubbleInText;
  const visibleActions = (m.actions ?? []).filter((a) => !('space' in a.do && a.do.space === space && !a.then));
  return (
    <Animated.View style={{ paddingHorizontal: 12, marginTop: joinedOlder ? 3 : 10, alignItems: mine ? 'flex-end' : 'flex-start', opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
      <View style={{ maxWidth: mine ? '82%' : '92%', backgroundColor: mine ? c.bubbleOut : c.bubbleIn, borderWidth: mine ? 0 : 1, borderColor: c.border, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderTopLeftRadius: !mine && joinedOlder ? r : R, borderTopRightRadius: mine && joinedOlder ? r : R, borderBottomLeftRadius: mine ? R : r, borderBottomRightRadius: mine ? r : R }}>
        {mine ? <Txt style={{ color: fg, fontSize: 16, lineHeight: 22 }} selectable>{m.text}</Txt> : <RichBot text={m.text} color={fg} codeBg={c.sunken} />}
        {m.ai && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}><Icon name="sparkles" size={11} tone="faint" /><Txt v="caption" tone="faint">Respuesta generada con IA</Txt></View>}
      </View>
      {!mine && showOffers && (
        <View style={{ marginTop: 8, gap: 8, maxWidth: '96%' }}>
          {visibleActions.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {visibleActions.map((a) => (
                <Pressy key={a.label} onPress={() => onAction(a)} accessibilityRole="button" accessibilityLabel={a.label} scale={0.94} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 15, height: 40, borderRadius: 20, backgroundColor: c.accent }}>
                  <Icon name={a.icon as IconName} size={16} color={c.accentText} /><Txt v="smallStrong" style={{ color: c.accentText }}>{a.label}</Txt>
                </Pressy>
              ))}
            </View>
          )}
          {m.menu?.map((sec) => (
            <View key={sec.title} style={{ gap: 6 }}>
              <Txt v="mono" tone="faint" style={{ marginLeft: 4 }}>{tr(sec.title).toUpperCase()}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{sec.chips.map((ch) => <OfferChip key={ch.label} chip={ch} onPress={onChip} />)}</View>
            </View>
          ))}
          {m.chips && m.chips.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{m.chips.map((ch) => <OfferChip key={ch.label} chip={ch} onPress={onChip} />)}</View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function OfferChip({ chip, onPress }: { chip: ChipT; onPress: (c: ChipT) => void }) {
  const { c } = useTheme();
  return (
    <Pressy onPress={() => onPress(chip)} accessibilityRole="button" accessibilityLabel={chip.label} scale={0.94} style={{ paddingHorizontal: 13, minHeight: 34, paddingVertical: 6, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.accentSoft, justifyContent: 'center' }}>
      <Txt v="smallStrong" style={{ color: c.accentSoftText }}>{chip.label}</Txt>
    </Pressy>
  );
}
