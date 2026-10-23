import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, NativeSyntheticEvent, Platform, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { BizHeader, Key, NoBusiness } from '../../components/BizUi';
import { DoerAction, SUGGESTIONS, SUGGESTIONS_I18N, interpret } from '../../features/doer/actions';
import { askDoer, doerAiMaybe } from '../../features/doer/ai';
import { ExecResult, describe, execute } from '../../features/doer/execute';
import { Customer, crmSync, listCustomers } from '../../lib/biz';
import { hapticSoft, hapticSuccess } from '../../lib/haptics';
import { useAuth } from '../../state/AuthProvider';
import { useChats } from '../../state/ChatsProvider';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { font } from '../../theme/tokens';
import { Icon, IconName, Pressy, Txt, TypingDots, useToast } from '../../ui';
import { getLocale, t, tr } from '../../i18n';

type Msg = { id: string; from: 'me' | 'doer'; text: string; plan?: { actions: DoerAction[]; status: 'pending' | 'running' | 'done' | 'cancelled'; results?: ExecResult[] }; chips?: boolean };
let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
const WELCOME = '¡Hola! Soy **Doer**. Dime qué necesitas en tu negocio y yo lo hago: agendar citas, guardar respuestas rápidas, subir productos, crear tareas, programar mensajes… Elige un ejemplo o escríbeme con tus palabras.';

export default function Doer() {
  const { c, r } = useTheme();
  const { active, refreshBusinesses } = useSpace();
  const { user } = useAuth();
  const { chats } = useChats();
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const input = useRef<TextInput>(null);
  const bid = active?.business.id;
  const storeKey = bid ? `cifra.doer.${bid}` : null;
  const canWrite = active?.role !== 'viewer';

  useEffect(() => {
    if (!storeKey) return;
    AsyncStorage.getItem(storeKey).then((v) => { setMsgs(v ? (JSON.parse(v) as Msg[]).map((m) => (m.plan?.status === 'running' ? { ...m, plan: { ...m.plan, status: 'pending' as const } } : m)) : [{ id: uid(), from: 'doer', text: WELCOME, chips: true }]); }).catch(() => setMsgs([{ id: uid(), from: 'doer', text: WELCOME, chips: true }]));
  }, [storeKey]);
  useEffect(() => { if (storeKey && msgs.length) AsyncStorage.setItem(storeKey, JSON.stringify(msgs.slice(-40))).catch(() => {}); }, [msgs, storeKey]);
  useEffect(() => {
    if (!bid) return;
    (async () => { try { if (canWrite) await crmSync(bid).catch(() => {}); setCustomers(await listCustomers(bid)); } catch { /* optional */ } })();
  }, [bid, canWrite]);

  const add = (m: Omit<Msg, 'id'>) => setMsgs((cur) => [...cur, { ...m, id: uid() }]);
  const patchMsg = (id: string, fn: (m: Msg) => Msg) => setMsgs((cur) => cur.map((m) => (m.id === id ? fn(m) : m)));

  const send = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || busy || !active) return;
    setText(''); add({ from: 'me', text: q }); setBusy(true); hapticSoft();
    const known = { customers: customers.map((x) => x.name) };
    let reply = interpret(q, known, new Date(), getLocale());
    if (!reply && doerAiMaybe()) {
      const history = [...msgs.filter((m) => m.text && !m.chips).slice(-6).map((m) => ({ role: m.from === 'me' ? ('user' as const) : ('assistant' as const), content: m.text })), { role: 'user' as const, content: q }];
      reply = await askDoer(history, { businessName: active.business.name, customers: known.customers });
    }
    await new Promise((res) => setTimeout(res, 350));
    if (!reply || (!reply.actions.length && !reply.reply)) add({ from: 'doer', text: 'No estoy seguro de qué quieres que haga 🤔. Prueba con una de estas ideas y cámbiale los datos:', chips: true });
    else add({ from: 'doer', text: reply.reply || (reply.actions.length ? 'Esto es lo que voy a hacer:' : ''), plan: reply.actions.length ? { actions: reply.actions, status: 'pending' } : undefined });
    setBusy(false);
  }, [busy, active, customers, msgs]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (m: Msg) => {
    if (!m.plan || !active || !user) return;
    patchMsg(m.id, (x) => ({ ...x, plan: { ...x.plan!, status: 'running' } }));
    const results: ExecResult[] = [];
    let fresh = customers;
    for (const a of m.plan.actions) {
      const res = await execute(a, { businessId: active.business.id, me: user.id, chats, customers: fresh, refreshBusinesses, go: (p) => router.push(p as never) });
      results.push(res);
      if (res.ok && (a.type === 'customer' || a.type === 'customer_update')) { try { fresh = await listCustomers(active.business.id); setCustomers(fresh); } catch { /* keep */ } }
    }
    patchMsg(m.id, (x) => ({ ...x, plan: { ...x.plan!, status: 'done', results } }));
    if (results.every((x) => x.ok)) hapticSuccess(); else toast.show('Algo no se pudo hacer; mira el detalle.', 'error');
  };

  const onKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const ev = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) { (e as unknown as { preventDefault: () => void }).preventDefault(); send(text); }
  };

  if (!active) return <NoBusiness onCreate={() => router.push('/business-create')} />;
  const data = [...msgs].reverse();
  const canSend = !!text.trim() && !busy && canWrite;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BizHeader eyebrow="Asistente" title="Doer" sub="Dile qué hacer y lo hace por ti" right={<Key icon="trash-outline" onPress={() => { if (storeKey) AsyncStorage.removeItem(storeKey).catch(() => {}); setMsgs([{ id: uid(), from: 'doer', text: WELCOME, chips: true }]); }} />} />
      <FlatList
        data={data} inverted keyExtractor={(m) => m.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 12 }}
        ListHeaderComponent={busy ? <Row from="doer"><TypingDots size={6} /></Row> : null}
        renderItem={({ item }) => (
          <Row from={item.from}>
            <RichLite text={item.text} />
            {item.chips && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {(getLocale() === 'es' ? SUGGESTIONS : SUGGESTIONS_I18N[getLocale() as 'en' | 'de']).map((s) => (
                  <Pressy key={s.label} onPress={() => { setText(s.prompt); input.current?.focus(); }} accessibilityRole="button" accessibilityLabel={s.label} scale={0.96} hoverStyle={{ backgroundColor: c.surfaceAlt }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 40, borderRadius: r(8), backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                    <Icon name={s.icon as IconName} size={16} color={c.highlight} /><Txt v="smallStrong">{s.label}</Txt>
                  </Pressy>
                ))}
              </View>
            )}
            {item.plan && <Plan msg={item} onRun={() => run(item)} onCancel={() => patchMsg(item.id, (x) => ({ ...x, plan: { ...x.plan!, status: 'cancelled' } }))} canWrite={canWrite} />}
          </Row>
        )}
      />
      <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1, minHeight: 46, maxHeight: 120, borderRadius: r(10), backgroundColor: c.bg, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 14, justifyContent: 'center' }}>
          <TextInput ref={input} value={text} onChangeText={setText} onKeyPress={onKey} multiline maxLength={600} editable={canWrite}
            placeholder={tr(canWrite ? 'Dile a Doer qué hacer…' : 'Tu rol es de solo lectura')} placeholderTextColor={c.textFaint} selectionColor={c.highlight} accessibilityLabel={tr('Mensaje para Doer')}
            style={{ color: c.text, fontFamily: font.regular, fontSize: 16, lineHeight: 22, paddingVertical: 0, marginVertical: 11, outlineStyle: 'none' } as object} />
        </View>
        <Pressy onPress={() => send(text)} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Enviar a Doer" scale={0.92} style={{ width: 46, height: 46, borderRadius: r(10), backgroundColor: canSend ? c.highlight : c.sunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-up" size={22} color={canSend ? c.highlightText : c.textFaint} />
        </Pressy>
      </View>
    </View>
  );
}

/** Slack-style message row: square avatar, name, text. No bubbles in Business. */
function Row({ from, children }: { from: 'me' | 'doer'; children: React.ReactNode }) {
  const { c, r } = useTheme();
  const { profile } = useAuth();
  return (
    <View style={{ flexDirection: 'row', gap: 11, paddingHorizontal: 16, paddingVertical: 8 }}>
      {from === 'doer'
        ? <View style={{ width: 36, height: 36, borderRadius: r(10), backgroundColor: c.highlight, alignItems: 'center', justifyContent: 'center' }}><Icon name="flash" size={19} color={c.highlightText} /></View>
        : <View style={{ width: 36, height: 36, borderRadius: r(10), backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Txt style={{ color: c.accentText, fontFamily: font.display, fontSize: 15 }}>{(profile?.display_name ?? 'Tú').slice(0, 1).toUpperCase()}</Txt></View>}
      <View style={{ flex: 1, gap: 3 }}>
        <Txt v="smallStrong" style={{ fontFamily: font.display }}>{from === 'doer' ? 'Doer' : profile?.display_name ?? 'Tú'}</Txt>
        <View>{children}</View>
      </View>
    </View>
  );
}

function RichLite({ text }: { text: string }) {
  const parts = tr(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return <Txt style={{ fontSize: 15.5, lineHeight: 22 }} selectable>{parts.map((p, i) => (p.startsWith('**') ? <Txt key={i} style={{ fontFamily: font.bold, fontSize: 15.5, lineHeight: 22 }}>{p.slice(2, -2)}</Txt> : p))}</Txt>;
}

function Plan({ msg, onRun, onCancel, canWrite }: { msg: Msg; onRun: () => void; onCancel: () => void; canWrite: boolean }) {
  const { c, r } = useTheme();
  const plan = msg.plan!;
  return (
    <View style={{ marginTop: 10, borderRadius: r(12), borderWidth: 1, borderColor: plan.status === 'done' ? c.success : c.borderStrong, backgroundColor: c.surface, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.sunken }}>
        <Icon name={plan.status === 'done' ? 'checkmark-circle' : 'list'} size={15} color={plan.status === 'done' ? c.success : c.textMuted} />
        <Txt v="mono" tone="muted">{plan.status === 'done' ? 'HECHO' : plan.status === 'cancelled' ? 'CANCELADO' : plan.status === 'running' ? 'HACIÉNDOLO…' : t('PLAN · {n} {w}', { n: plan.actions.length, w: tr(plan.actions.length === 1 ? 'PASO' : 'PASOS') })}</Txt>
      </View>
      {plan.actions.map((a, i) => {
        const d = describe(a);
        const res = plan.results?.[i];
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: c.border, opacity: plan.status === 'cancelled' ? 0.45 : 1 }}>
            <Icon name={(res ? (res.ok ? 'checkmark-circle' : 'alert-circle') : (d.icon as IconName))} size={18} color={res ? (res.ok ? c.success : c.danger) : c.highlight} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="smallStrong">{d.title}</Txt>
              {d.detail ? <Txt v="small" tone="muted">{d.detail}</Txt> : null}
              {res && <Txt v="small" style={{ color: res.ok ? c.success : c.danger }}>{res.text}</Txt>}
              {res?.ok && res.href && <Pressy onPress={() => router.push(res.href as never)} accessibilityRole="link" scale={0.96} style={{ alignSelf: 'flex-start', marginTop: 4 }}><Txt v="smallStrong" style={{ color: c.highlight }}>Ver →</Txt></Pressy>}
            </View>
          </View>
        );
      })}
      {plan.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: c.border }}>
          <Key primary icon="flash" label={canWrite ? 'Hacerlo' : 'Solo lectura'} onPress={canWrite ? onRun : () => {}} />
          <Key label="Cancelar" onPress={onCancel} />
        </View>
      )}
    </View>
  );
}
