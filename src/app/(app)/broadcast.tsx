import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { BizHeader } from '../../components/BizUi';
import { BroadcastRow, Stage, broadcastAudience, listBroadcasts, sendBroadcast, stages } from '../../lib/biz';
import { canManage } from '../../lib/business';
import { friendly } from '../../lib/errors';
import { relative } from '../../lib/format';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Chip, EmptyState, Field, Icon, Sheet, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

/** "Difusión": one message to all (or a segment of) the customers who have a CIFRA account. Managers only. */
export default function Broadcast() {
  const { c, r } = useTheme();
  const { active } = useSpace();
  const toast = useToast();
  const biz = active?.business;
  const manage = canManage(active?.role);
  const [stage, setStage] = useState<Stage | null>(null);
  const [tag, setTag] = useState('');
  const [body, setBody] = useState('');
  const [aud, setAud] = useState<{ total: number; reachable: number } | null>(null);
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const loadHistory = useCallback(() => { if (biz && manage) listBroadcasts(biz.id).then(setHistory).catch(() => {}); }, [biz, manage]);
  useEffect(loadHistory, [loadHistory]);
  useEffect(() => {
    if (!biz || !manage) return;
    let live = true;
    const id = setTimeout(() => { broadcastAudience(biz.id, stage, tag.trim() || null).then((a) => live && setAud(a)).catch(() => live && setAud(null)); }, 350);
    return () => { live = false; clearTimeout(id); };
  }, [biz, manage, stage, tag]);

  const send = async () => {
    if (!biz) return;
    setSending(true);
    try {
      const n = await sendBroadcast(biz.id, body.trim(), stage, tag.trim() || null);
      toast.show(t('Enviado a {n} clientes', { n }), 'success');
      setConfirm(false); setBody(''); loadHistory();
    } catch (e) {
      const m = String((e as Error)?.message ?? '');
      toast.show(/broadcast_limit/.test(m) ? 'Ya enviaste 3 difusiones en las últimas 24 horas. Inténtalo mañana.' : friendly(e), 'error');
    } finally { setSending(false); }
  };

  if (!biz) return <View style={{ flex: 1, backgroundColor: c.bg }}><BizHeader eyebrow="Negocio" title="Difusión" /><EmptyState icon="megaphone" title="Elige un negocio" body="Las difusiones se envían desde tu negocio." /></View>;
  if (!manage) return <View style={{ flex: 1, backgroundColor: c.bg }}><BizHeader eyebrow="Negocio" title="Difusión" sub={biz.name} /><EmptyState icon="lock-closed" title="Solo la dirección" body="Propietario, administradores y supervisores pueden enviar difusiones." /></View>;

  const reach = aud?.reachable ?? 0;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BizHeader eyebrow="Negocio" title="Difusión" sub={biz.name} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 640, gap: 14 }}>
            <View style={{ gap: 10, padding: 14, borderRadius: r(12), borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
              <Txt v="smallStrong">1 · ¿A quién?</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Chip label="Todos" active={stage === null} onPress={() => setStage(null)} />
                {stages.map((s) => <Chip key={s.key} label={s.label} active={stage === s.key} onPress={() => setStage(s.key)} />)}
              </ScrollView>
              <Field label="Etiqueta (opcional)" value={tag} onChangeText={setTag} autoCapitalize="none" placeholder="vip" />
              <Txt v="small" tone="muted">{aud ? t('Llegará a {n} de {total} clientes. Los contactos sin cuenta de CIFRA, quienes se dieron de baja y el equipo no lo reciben.', { n: aud.reachable, total: aud.total }) : 'Calculando…'}</Txt>
            </View>

            <View style={{ gap: 10, padding: 14, borderRadius: r(12), borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
              <Txt v="smallStrong">2 · Tu mensaje</Txt>
              <Field value={body} onChangeText={setBody} multiline maxLength={1000} placeholder="Nueva colección de otoño · 10 % hasta el domingo" />
              <Txt v="caption" tone="muted">{body.length}/1000 · Cada cliente lo recibe en su chat contigo, marcado como difusión y con un enlace para dejar de recibirlas. Máximo 3 al día.</Txt>
              <Button title={reach > 0 ? t('Enviar a {n} clientes', { n: reach }) : 'Enviar'} icon="megaphone" size="lg" disabled={!body.trim() || reach < 1} onPress={() => setConfirm(true)} />
            </View>

            <View style={{ gap: 8 }}>
              <Txt v="smallStrong">Enviadas</Txt>
              {history.length === 0 ? <Txt v="small" tone="muted">Aún no has enviado ninguna.</Txt> : history.map((h) => (
                <View key={h.id} style={{ gap: 4, padding: 12, borderRadius: r(10), borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
                  <Txt numberOfLines={3}>{h.body}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="people" size={13} tone="faint" /><Txt v="caption" tone="muted">{t('{n} clientes', { n: h.recipients })} · {relative(h.created_at)}{h.sent_by_name ? ` · ${h.sent_by_name}` : ''}</Txt>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={confirm} onClose={() => !sending && setConfirm(false)} title="¿Enviar ahora?">
        <View style={{ gap: 12 }}>
          <Txt v="small" tone="muted">{t('Lo recibirán {n} clientes en su chat con {name}. No se puede deshacer.', { n: reach, name: biz.name })}</Txt>
          <View style={{ padding: 12, borderRadius: r(10), backgroundColor: c.sunken }}><Txt>{body.trim()}</Txt></View>
          <Button title="Sí, enviar" icon="send" size="lg" loading={sending} onPress={send} />
          <Button title="Cancelar" variant="ghost" disabled={sending} onPress={() => setConfirm(false)} />
        </View>
      </Sheet>
    </View>
  );
}
