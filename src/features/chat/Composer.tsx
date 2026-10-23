import { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, NativeSyntheticEvent, Platform, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Message, QuickReply } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { bytes } from '../../lib/format';
import { Picked, pickChatMedia, pickDocument, takePhoto } from '../../lib/media';
import { MAX_VOICE_MS, VoiceRecorder, clock, voiceSupported } from '../../lib/voice';
import { useTheme } from '../../theme/ThemeProvider';
import { font } from '../../theme/tokens';
import { Icon, IconButton, Pressy, Sheet, SheetRow, Txt, useToast } from '../../ui';
import { VideoThumb } from './VideoPlayer';
import { loc, t, tr } from '../../i18n';

type Props = {
  onSend: (v: { body: string; file: Picked | null; internal: boolean; replyTo: string | null }) => void;
  onEditSave: (id: string, body: string) => void;
  onTyping: () => void;
  replyTo: Message | null; replyAuthor?: string; onCancelReply: () => void;
  editing: Message | null; onCancelEdit: () => void;
  agent: boolean; quickReplies: QuickReply[];
  disabledReason?: string | null;
  autoFocus?: boolean;
  onSchedule?: (body: string, sendAt: Date, replyTo: string | null, internal: boolean) => Promise<void> | void;
};

export function Composer(p: Props) {
  const { c, r, incognito } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [file, setFile] = useState<Picked | null>(null);
  const [internal, setInternal] = useState(false);
  const [attach, setAttach] = useState(false);
  const [quick, setQuick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inputH, setInputH] = useState(24);
  const input = useRef<TextInput>(null);
  const [rec, setRec] = useState<{ ms: number; levels: number[] } | null>(null);
  const [sending, setSending] = useState(false);
  const [sched, setSched] = useState(false);
  const [customAt, setCustomAt] = useState('');
  const recorder = useRef<VoiceRecorder | null>(null);
  const morph = useRef(new Animated.Value(1)).current;
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => () => recorder.current?.cancel(), []);
  const hasText = !!text.trim() || !!file;
  useEffect(() => { morph.setValue(0.5); Animated.spring(morph, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 18, bounciness: 16 }).start(); }, [hasText, morph]);
  useEffect(() => {
    if (!rec) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(blink, { toValue: 0.25, duration: 600, useNativeDriver: Platform.OS !== 'web' }), Animated.timing(blink, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' })]));
    loop.start();
    return () => loop.stop();
  }, [!!rec, blink]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastEdit = useRef<string | null>(null);

  if (p.editing && lastEdit.current !== p.editing.id) { lastEdit.current = p.editing.id; setTimeout(() => setText(p.editing?.body ?? ''), 0); }
  if (!p.editing && lastEdit.current) { lastEdit.current = null; setTimeout(() => setText(''), 0); }

  if (p.disabledReason) {
    return <View style={{ padding: 16, paddingBottom: 16 + insets.bottom, alignItems: 'center', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}><Txt v="small" tone="muted" style={{ textAlign: 'center' }}>{p.disabledReason}</Txt></View>;
  }

  const canSend = !!text.trim() || !!file;
  const send = () => {
    if (!canSend || busy) return;
    if (p.editing) { p.onEditSave(p.editing.id, text.trim()); setText(''); return; }
    p.onSend({ body: text, file, internal, replyTo: p.replyTo?.id ?? null });
    setText(''); setInputH(24); setFile(null); p.onCancelReply();
    setTimeout(() => input.current?.focus(), 0);
  };

  const run = async (fn: () => Promise<Picked | null>) => {
    setAttach(false); setBusy(true);
    try { const f = await fn(); if (f) setFile(f); } catch (e) { toast.show(friendly(e, 'No se pudo adjuntar el archivo.'), 'error'); } finally { setBusy(false); }
  };

  const startRec = async () => {
    if (!voiceSupported()) return toast.show('Tu navegador no permite grabar audio.', 'error');
    try {
      const r = new VoiceRecorder();
      recorder.current = r;
      setRec({ ms: 0, levels: [] });
      await r.start((level, ms) => {
        setRec((cur) => (cur ? { ms, levels: [...cur.levels.slice(-39), level] } : cur));
        if (ms >= MAX_VOICE_MS) finishRec(true);
      });
    } catch (e) {
      recorder.current?.cancel(); recorder.current = null; setRec(null);
      toast.show(/denied|permission|NotAllowed/i.test(String(e)) ? 'Permite el micrófono para grabar mensajes de voz.' : 'No se pudo iniciar la grabación.', 'error');
    }
  };
  const cancelRec = () => { recorder.current?.cancel(); recorder.current = null; setRec(null); };
  const finishRec = async (send: boolean) => {
    const r = recorder.current; if (!r) return;
    recorder.current = null;
    if (!send) { r.cancel(); setRec(null); return; }
    setSending(true);
    try {
      const f = await r.stop();
      if ((f.durationMs ?? 0) < 700) { toast.show('Mantén la grabación un poco más.', 'info'); }
      else p.onSend({ body: '', file: f, internal, replyTo: p.replyTo?.id ?? null });
      p.onCancelReply();
    } catch (e) { toast.show(friendly(e, 'No se pudo grabar el audio.'), 'error'); } finally { setRec(null); setSending(false); }
  };

  const scheduleAt = async (when: Date) => {
    if (!text.trim() || !p.onSchedule) return;
    setSched(false);
    try { await p.onSchedule(text.trim(), when, p.replyTo?.id ?? null, internal); setText(''); setInputH(24); p.onCancelReply(); toast.show(t('Programado para {when}', { when: when.toLocaleString(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }), 'success'); }
    catch (e) { toast.show(friendly(e, 'No se pudo programar el mensaje.'), 'error'); }
  };
  const presets = (() => {
    const now = new Date(); const out: { label: string; sub: string; at: Date }[] = [];
    out.push({ label: 'En 1 hora', sub: new Date(now.getTime() + 3600e3).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' }), at: new Date(now.getTime() + 3600e3) });
    const tonight = new Date(now); tonight.setHours(21, 0, 0, 0);
    if (tonight.getTime() - now.getTime() > 20 * 60e3) out.push({ label: 'Esta noche', sub: '21:00', at: tonight });
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
    out.push({ label: 'Mañana por la mañana', sub: '9:00', at: tomorrow });
    const monday = new Date(now); monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7)); monday.setHours(9, 0, 0, 0);
    out.push({ label: 'El lunes', sub: '9:00', at: monday });
    return out;
  })();

  const onKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const ev = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) { (e as unknown as { preventDefault: () => void }).preventDefault(); send(); }
  };

  if (rec) {
    return (
      <View style={{ backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton icon="trash" label="Descartar grabación" tone="danger" size={46} onPress={cancelRec} />
        <View style={{ flex: 1, height: 46, borderRadius: r(23), backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.danger, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
          <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger, opacity: blink }} />
          <Txt v="mono" style={{ fontSize: 13, minWidth: 34 }}>{clock(rec.ms)}</Txt>
          <View style={{ flex: 1, height: 28, flexDirection: 'row', alignItems: 'center', gap: 2, overflow: 'hidden', justifyContent: 'flex-end' }}>
            {rec.levels.map((l, i) => <View key={i} style={{ width: 3, height: Math.max(4, 28 * l), borderRadius: 2, backgroundColor: c.accent, opacity: 0.4 + 0.6 * (i / Math.max(1, rec.levels.length)) }} />)}
          </View>
        </View>
        <Pressy onPress={() => finishRec(true)} disabled={sending} accessibilityRole="button" accessibilityLabel="Enviar mensaje de voz" scale={0.9} style={{ width: 46, height: 46, borderRadius: r(23), backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          {sending ? <ActivityIndicator color={c.accentText} /> : <Icon name="arrow-up" size={22} color={c.accentText} />}
        </Pressy>
      </View>
    );
  }

  const tint = internal ? c.internal : c.surface;
  return (
    <View style={{ backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 8) }}>
      {(p.replyTo || p.editing) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10 }}>
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c.highlight }} />
          <View style={{ flex: 1 }}>
            <Txt v="caption" style={{ color: c.highlight }}>{p.editing ? 'Editando mensaje' : t('Respondiendo a {name}', { name: p.replyAuthor ?? tr('mensaje') })}</Txt>
            <Txt v="small" tone="muted" numberOfLines={1}>{(p.editing ?? p.replyTo)?.body ?? 'Adjunto'}</Txt>
          </View>
          <IconButton icon="close" label="Cancelar" size={32} tone="muted" onPress={p.editing ? p.onCancelEdit : p.onCancelReply} />
        </View>
      )}
      {file && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, margin: 10, marginBottom: 0, padding: 8, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          {file.type.startsWith('image/') ? <Image source={{ uri: file.uri }} style={{ width: 56, height: 56, borderRadius: 10 }} /> : file.type.startsWith('video/') && Platform.OS === 'web' ? <VideoThumb url={file.uri} width={56} height={56} onOpen={() => {}} /> : <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={file.type.startsWith('video/') ? 'play' : 'document-text'} size={24} color={c.accentSoftText} /></View>}
          <View style={{ flex: 1 }}><Txt v="smallStrong" numberOfLines={1}>{file.name}</Txt><Txt v="caption" tone="muted">{bytes(file.size)}</Txt></View>
          <IconButton icon="close-circle" label="Quitar adjunto" tone="muted" size={36} onPress={() => setFile(null)} />
        </View>
      )}
      {p.agent && (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
          <Pressy onPress={() => setInternal(false)} accessibilityRole="button" accessibilityState={{ selected: !internal }} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: !internal ? c.accent : c.sunken }}>
            <Icon name="chatbubble" size={13} color={!internal ? c.accentText : c.textMuted} /><Txt v="caption" style={{ color: !internal ? c.accentText : c.textMuted }}>Responder al cliente</Txt>
          </Pressy>
          <Pressy onPress={() => setInternal(true)} accessibilityRole="button" accessibilityState={{ selected: internal }} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: internal ? c.warning : c.sunken }}>
            <Icon name="lock-closed" size={13} color={internal ? '#fff' : c.textMuted} /><Txt v="caption" style={{ color: internal ? '#fff' : c.textMuted }}>Nota interna</Txt>
          </Pressy>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8 }}>
        {!p.editing && <IconButton icon="add" label="Adjuntar" size={44} tone="accent" onPress={() => setAttach(true)} />}
        <View style={{ flex: 1, minHeight: 46, maxHeight: 140, borderRadius: r(23), backgroundColor: tint, borderWidth: 1.5, borderColor: internal ? c.internalBorder : c.border, paddingHorizontal: 16, justifyContent: 'center' }}>
          <TextInput
            ref={input} autoFocus={p.autoFocus} value={text} onChangeText={(t) => { setText(t); if (t) p.onTyping(); }} multiline numberOfLines={1} onKeyPress={onKey}
            onContentSizeChange={(e) => setInputH(Math.min(120, Math.max(24, e.nativeEvent.contentSize.height)))}
            placeholder={tr(internal ? 'Nota solo para tu equipo' : p.editing ? 'Edita tu mensaje' : 'Escribe un mensaje')} placeholderTextColor={c.textFaint} selectionColor={c.accent} accessibilityLabel={tr('Mensaje')}
            style={{ color: c.text, fontFamily: incognito ? font.typewriter : font.regular, fontSize: 16, lineHeight: 22, height: text ? inputH : 24, paddingVertical: 0, marginVertical: 11, outlineStyle: 'none' } as object}
          />
        </View>
        {p.agent && !p.editing && p.quickReplies.length > 0 && <IconButton icon="flash" label="Respuestas rápidas" size={44} tone="accent" onPress={() => setQuick(true)} />}
        {canSend && !p.editing && p.onSchedule && !file && <IconButton icon="time-outline" label="Programar envío" size={44} tone="accent" pop onPress={() => setSched(true)} />}
        <Animated.View style={{ transform: [{ scale: morph }, { rotate: morph.interpolate({ inputRange: [0.5, 1], outputRange: ['-25deg', '0deg'] }) }] }}>
        {!canSend && !p.editing && voiceSupported() ? (
          <Pressy onPress={startRec} disabled={busy} accessibilityRole="button" accessibilityLabel="Grabar mensaje de voz" scale={0.9}
            style={{ width: 46, height: 46, borderRadius: r(23), backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color={c.accentText} /> : <Icon name="mic" size={22} color={c.accentText} />}
          </Pressy>
        ) : (
          <Pressy onPress={send} disabled={!canSend || busy} accessibilityRole="button" accessibilityLabel={p.editing ? 'Guardar cambios' : 'Enviar'} scale={0.9}
            style={{ width: 46, height: 46, borderRadius: r(23), backgroundColor: canSend ? c.accent : c.sunken, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color={c.accentText} /> : <Icon name={p.editing ? 'checkmark' : 'arrow-up'} size={22} color={canSend ? c.accentText : c.textFaint} />}
          </Pressy>
        )}
        </Animated.View>
      </View>

      <Sheet visible={attach} onClose={() => setAttach(false)} title="Adjuntar">
        <SheetRow icon="images" label="Foto o vídeo" sub="Desde tu galería" onPress={() => run(pickChatMedia)} />
        {Platform.OS !== 'web' && <SheetRow icon="camera" label="Cámara" sub="Haz una foto ahora" onPress={() => run(takePhoto)} />}
        <SheetRow icon="document-text" label="Documento" sub="PDF, texto y más · máx. 25 MB" onPress={() => run(pickDocument)} />
      </Sheet>
      <Sheet visible={sched} onClose={() => setSched(false)} title="Programar mensaje">
        <Txt v="small" tone="muted" style={{ marginBottom: 6 }}>Se enviará solo a la hora elegida, aunque tengas CIFRA cerrado.</Txt>
        {presets.map((x) => <SheetRow key={x.label} icon="alarm" label={x.label} sub={x.sub} onPress={() => scheduleAt(x.at)} />)}
        {Platform.OS === 'web' && (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Txt v="caption" tone="muted">O elige fecha y hora</Txt>
            <View style={{ gap: 10 }}>
              {createElement('input', { type: 'datetime-local', value: customAt, min: new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 120000).toISOString().slice(0, 16), onChange: (e: { target: { value: string } }) => setCustomAt(e.target.value), style: { width: '100%', boxSizing: 'border-box', height: 46, borderRadius: 14, border: `1.5px solid ${c.border}`, padding: '0 12px', fontSize: 16, background: c.surface, color: c.text, fontFamily: 'Inter_500Medium' } })}
              <Pressy onPress={() => customAt && scheduleAt(new Date(customAt))} disabled={!customAt} accessibilityRole="button" accessibilityLabel="Programar" scale={0.97} style={{ height: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: customAt ? 1 : 0.4 }}>
                <Txt v="bodyStrong" style={{ color: c.accentText }}>Programar</Txt>
              </Pressy>
            </View>
          </View>
        )}
      </Sheet>
      <Sheet visible={quick} onClose={() => setQuick(false)} title="Respuestas rápidas">
        {p.quickReplies.map((q) => <SheetRow key={q.id} icon="flash" label={`/${q.shortcut}`} sub={q.body} onPress={() => { setText(q.body); setQuick(false); input.current?.focus(); }} />)}
      </Sheet>
    </View>
  );
}
