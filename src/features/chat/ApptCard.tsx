import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Appointment, apptMeta, getAppointment, hm, parseApptCard, respondAppointment } from '../../lib/biz';
import { friendly } from '../../lib/errors';
import { useTheme } from '../../theme/ThemeProvider';
import { font } from '../../theme/tokens';
import { Icon, Pressy, Txt, useToast } from '../../ui';
import { loc } from '../../i18n';

const cache = new Map<string, Appointment | null>();

/** Appointment card posted into a chat by the agenda: date tile, status, and (for the customer) one-tap confirm / cancel. */
export function ApptCard({ body, mine, team }: { body: string; mine: boolean; team: boolean }) {
  const { c, r } = useTheme();
  const toast = useToast();
  const card = parseApptCard(body)!;
  const [appt, setAppt] = useState<Appointment | null | undefined>(card.id ? cache.get(card.id) : null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!card.id) return;
    let live = true;
    getAppointment(card.id).then((a) => { cache.set(card.id!, a); if (live) setAppt(a); }).catch(() => {});
    return () => { live = false; };
  }, [card.id]);

  const d = card.start;
  const status = appt?.status;
  const meta = status ? apptMeta[status] : null;
  const actionable = !team && !!appt && ['requested', 'scheduled', 'confirmed'].includes(appt.status) && appt.status !== 'requested' && new Date(appt.starts_at) > new Date();
  const fg = mine ? c.bubbleOutText : c.text;
  const sub = mine ? c.bubbleOutMeta : c.textMuted;
  const respond = async (s: 'confirmed' | 'cancelled') => {
    if (!card.id) return; setBusy(true);
    try { await respondAppointment(card.id, s); cache.delete(card.id); setAppt(await getAppointment(card.id)); toast.show(s === 'confirmed' ? 'Cita confirmada' : 'Cita cancelada', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <View style={{ minWidth: 236, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 52, borderRadius: r(14), overflow: 'hidden', backgroundColor: mine ? 'rgba(255,255,255,0.16)' : c.surfaceAlt, alignItems: 'center' }}>
          <View style={{ width: '100%', backgroundColor: meta?.color ?? c.highlight, alignItems: 'center', paddingVertical: 2 }}><Txt style={{ color: '#fff', fontFamily: font.mono, fontSize: 10, lineHeight: 13, textTransform: 'uppercase' }}>{d.toLocaleDateString(loc(), { month: 'short' }).replace('.', '')}</Txt></View>
          <Txt style={{ fontFamily: font.display, fontSize: 22, lineHeight: 28, color: fg }}>{d.getDate()}</Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 0.6, color: sub, textTransform: 'uppercase' }}>📅 {card.label}</Txt>
          <Txt v="bodyStrong" style={{ color: fg }} numberOfLines={2}>{card.title}</Txt>
          <Txt v="small" style={{ color: sub }}>{d.toLocaleDateString(loc(), { weekday: 'long' })} · {hm(d)}</Txt>
        </View>
      </View>
      {meta && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color }} /><Txt v="caption" style={{ color: sub }}>Estado actual: {meta.label}</Txt></View>}
      {actionable && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {appt!.status === 'scheduled' && <Pressy disabled={busy} onPress={() => respond('confirmed')} accessibilityRole="button" scale={0.94} style={{ flex: 1, height: 36, borderRadius: r(18), backgroundColor: mine ? 'rgba(255,255,255,0.9)' : c.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}><Icon name="checkmark" size={15} color={mine ? '#1a1a1a' : c.accentText} /><Txt v="smallStrong" style={{ color: mine ? '#1a1a1a' : c.accentText }}>Confirmar</Txt></Pressy>}
          <Pressy disabled={busy} onPress={() => respond('cancelled')} accessibilityRole="button" scale={0.94} style={{ flex: 1, height: 36, borderRadius: r(18), borderWidth: 1.5, borderColor: mine ? 'rgba(255,255,255,0.5)' : c.borderStrong, alignItems: 'center', justifyContent: 'center' }}><Txt v="smallStrong" style={{ color: fg }}>Cancelar cita</Txt></Pressy>
        </View>
      )}
      {team && <Pressy onPress={() => router.push('/agenda')} accessibilityRole="link" scale={0.96}><Txt v="smallStrong" style={{ color: mine ? c.bubbleOutText : c.highlight }}>Ver en la agenda →</Txt></Pressy>}
    </View>
  );
}
