import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { blockUser, listContacts, reportUser, saveContact } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Field, Icon, IconButton, Pressy, Sheet, SheetRow, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

const REASONS = ['Spam o publicidad', 'Se hace pasar por otra persona', 'Acoso o contenido ofensivo', 'Intento de estafa', 'Otro motivo'];
const key = (conv: string) => `cifra.unknown.dismissed.${conv}`;

/** Whether `peerId` is one of my contacts (null while loading). */
export function useIsContact(peerId: string | null | undefined) {
  const [known, setKnown] = useState<boolean | null>(null);
  useEffect(() => {
    if (!peerId) return;
    let live = true;
    listContacts().then((cs) => live && setKnown(cs.some((x) => x.contact_user_id === peerId))).catch(() => live && setKnown(true));
    return () => { live = false; };
  }, [peerId]);
  return { known, setKnown };
}

/** Sheet to report a person (or a business) who wrote to you; optionally blocks them right after. */
export function ReportSheet({ visible, onClose, me, peerId, businessId, conversationId, name, onBlocked }: { visible: boolean; onClose: () => void; me: string; peerId?: string | null; businessId?: string | null; conversationId: string; name: string; onBlocked?: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setReason(null); setDetail(''); setBlock(!!peerId); } }, [visible, peerId]);
  const send = async () => {
    if (!reason) return; setBusy(true);
    try {
      await reportUser(me, { reported_id: peerId ?? null, business_id: businessId ?? null, conversation_id: conversationId, reason: [reason, detail.trim()].filter(Boolean).join(' · ') });
      if (block && peerId) { await blockUser(me, peerId); onBlocked?.(); }
      toast.show(block && peerId ? 'Reporte enviado y contacto bloqueado' : 'Reporte enviado. Gracias por avisar.', 'success'); onClose();
    } catch (e) { toast.show(friendly(e, 'No se pudo enviar el reporte.'), 'error'); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Reportar a {name}', { name })}>
      {!reason ? (
        <>
          <Txt v="small" tone="muted" style={{ marginBottom: 6 }}>¿Qué ha pasado? Solo lo ve el equipo de CIFRA; la otra persona no sabrá quién la reportó.</Txt>
          {REASONS.map((r) => <SheetRow key={r} icon="flag-outline" label={r} onPress={() => setReason(r)} />)}
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <Pressy onPress={() => setReason(null)} accessibilityRole="button" scale={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="chevron-back" size={16} tone="muted" /><Txt v="smallStrong">{reason}</Txt></Pressy>
          <Field label="Detalles (opcional)" value={detail} onChangeText={setDetail} multiline maxLength={300} placeholder="Cuéntanos algo más" />
          {peerId && <SheetRow icon={block ? 'checkbox' : 'square-outline'} label="Bloquear también a este contacto" sub="No podrá volver a escribirte ni llamarte" onPress={() => setBlock(!block)} />}
          <Button title="Enviar reporte" icon="flag" variant="danger" loading={busy} onPress={send} />
        </View>
      )}
    </Sheet>
  );
}

/**
 * Shown above the composer when someone who is not in your contacts writes to you: add them, report them or block.
 * Dismissing it is remembered per conversation on this device.
 */
export function UnknownContactBar({ me, peerId, peerName, peerPhone, conversationId, onAdded, onBlocked }: { me: string; peerId: string; peerName: string; peerPhone: string | null; conversationId: string; onAdded: () => void; onBlocked: () => void }) {
  const { c, r } = useTheme();
  const toast = useToast();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { AsyncStorage.getItem(key(conversationId)).then((v) => setDismissed(v === '1')).catch(() => setDismissed(false)); }, [conversationId]);
  if (dismissed !== false) return null;
  const dismiss = () => { setDismissed(true); AsyncStorage.setItem(key(conversationId), '1').catch(() => {}); };
  const add = async () => {
    setBusy(true);
    try { await saveContact(me, { display_name: peerName, phone: peerPhone, contact_user_id: peerId }); toast.show(t('{name} añadido a tus contactos', { name: peerName }), 'success'); onAdded(); }
    catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };
  const blockNow = async () => {
    setBusy(true);
    try { await blockUser(me, peerId); toast.show('Contacto bloqueado', 'success'); onBlocked(); dismiss(); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <View style={{ marginHorizontal: 10, marginBottom: 6, padding: 12, borderRadius: r(16), backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="person-circle-outline" size={20} tone="muted" />
        <Txt v="small" style={{ flex: 1 }}>{t('{name} no está en tus contactos.', { name: peerName })} <Txt v="small" tone="muted">¿Lo conoces?</Txt></Txt>
        <IconButton icon="close" label="Cerrar aviso" tone="muted" size={30} onPress={dismiss} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressy onPress={add} disabled={busy} accessibilityRole="button" accessibilityLabel="Añadir a contactos" scale={0.95} style={{ flex: 1, height: 38, borderRadius: r(19), backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="person-add" size={15} color={c.accentText} /><Txt v="smallStrong" style={{ color: c.accentText }}>Añadir</Txt>
        </Pressy>
        <Pressy onPress={() => setReport(true)} disabled={busy} accessibilityRole="button" accessibilityLabel="Reportar" scale={0.95} style={{ flex: 1, height: 38, borderRadius: r(19), borderWidth: 1.5, borderColor: c.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="flag-outline" size={15} tone="text" /><Txt v="smallStrong">Reportar</Txt>
        </Pressy>
        <Pressy onPress={blockNow} disabled={busy} accessibilityRole="button" accessibilityLabel="Bloquear" scale={0.95} style={{ height: 38, paddingHorizontal: 14, borderRadius: r(19), backgroundColor: c.dangerSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="ban" size={15} color={c.danger} /><Txt v="smallStrong" style={{ color: c.danger }}>Bloquear</Txt>
        </Pressy>
      </View>
      <ReportSheet visible={report} onClose={() => setReport(false)} me={me} peerId={peerId} conversationId={conversationId} name={peerName} onBlocked={() => { onBlocked(); dismiss(); }} />
    </View>
  );
}
