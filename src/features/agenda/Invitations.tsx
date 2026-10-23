import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { MyAppointment, hm, myAppointments, respondAppointment } from '../../lib/biz';
import { friendly } from '../../lib/errors';
import { useChats } from '../../state/ChatsProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Icon, Pressy, Txt, useToast } from '../../ui';
import { loc, t } from '../../i18n';

/** The appointments other businesses hold with you: pending invitations first (`scheduled`), then accepted ones. */
export function useMyAppointments() {
  const { chats } = useChats();
  const [rows, setRows] = useState<MyAppointment[] | null>(null);
  const load = useCallback(async () => { try { setRows(await myAppointments()); } catch { setRows((r) => r ?? []); } }, []);
  // Invitations arrive as a card in a chat, so every inbox refresh is a good moment to re-check.
  const latest = chats[0]?.last_message_id;
  useEffect(() => { load(); }, [load, chats.length, latest]);
  const pending = (rows ?? []).filter((a) => a.status === 'scheduled' && new Date(a.ends_at) > new Date());
  const upcoming = (rows ?? []).filter((a) => a.status === 'confirmed' && new Date(a.ends_at) > new Date());
  return { rows, pending, upcoming, reload: load };
}

export const when = (a: MyAppointment) => `${new Date(a.starts_at).toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' })} · ${hm(a.starts_at)}`;

/** One invitation with Accept / Decline; `compact` is the version shown at the top of the chat list. */
export function InvitationRow({ a, onDone, compact }: { a: MyAppointment; onDone: () => void; compact?: boolean }) {
  const { c, r } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const respond = async (s: 'confirmed' | 'cancelled') => {
    setBusy(true);
    try { await respondAppointment(a.id, s); toast.show(s === 'confirmed' ? 'Invitación aceptada · la cita está en tu agenda' : 'Invitación rechazada', 'success'); onDone(); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, padding: compact ? 8 : 12, borderRadius: r(14), borderWidth: 1, borderColor: c.border }}>
      <Pressy onPress={() => a.conversation_id && router.push({ pathname: '/chat/[id]', params: { id: a.conversation_id } })} accessibilityRole="button" accessibilityLabel={t('Abrir el chat con {name}', { name: a.business_name })} scale={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={a.business_name} seed={a.business_id} path={a.logo_path} size={compact ? 36 : 44} business />
        <View style={{ flex: 1 }}>
          <Txt v="smallStrong" numberOfLines={1}>{a.title} · {a.business_name}</Txt>
          <Txt v="caption" tone="muted" numberOfLines={1}>{when(a)}{a.notes ? ` · ${a.notes}` : ''}</Txt>
        </View>
      </Pressy>
      <Pressy disabled={busy} onPress={() => respond('confirmed')} accessibilityRole="button" accessibilityLabel="Aceptar invitación" scale={0.9} style={{ height: 34, paddingHorizontal: 12, borderRadius: r(17), backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, opacity: busy ? 0.6 : 1 }}>
        <Icon name="checkmark" size={15} color={c.accentText} /><Txt v="caption" style={{ color: c.accentText, fontFamily: 'Inter_600SemiBold' }}>Aceptar</Txt>
      </Pressy>
      <Pressy disabled={busy} onPress={() => respond('cancelled')} accessibilityRole="button" accessibilityLabel="Rechazar invitación" scale={0.9} style={{ width: 34, height: 34, borderRadius: r(17), borderWidth: 1.5, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={16} tone="muted" />
      </Pressy>
    </View>
  );
}

/** Banner at the top of the Personal chat list: "N invitaciones de cita" with inline Accept / Decline. */
export function InvitationsBanner() {
  const { c, r } = useTheme();
  const { pending, upcoming, reload } = useMyAppointments();
  if (!pending.length && !upcoming.length) return null;
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 8, borderRadius: r(16), borderWidth: 1.5, borderColor: pending.length ? c.highlight : c.border, backgroundColor: pending.length ? c.accentSoft : c.surface, padding: 10, gap: 8 }}>
      <Pressy onPress={() => router.push('/my-appointments')} accessibilityRole="button" accessibilityLabel="Ver mis citas" scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={pending.length ? 'notifications' : 'calendar'} size={16} color={pending.length ? c.highlight : c.accent} />
        <Txt v="smallStrong" style={{ flex: 1, color: pending.length ? c.accentSoftText : c.text }}>{pending.length ? t('{n} invitaciones de cita por responder', { n: pending.length }) : t('{n} citas próximas', { n: upcoming.length })}</Txt>
        <Txt v="caption" tone={pending.length ? 'accent' : 'muted'}>Mis citas</Txt><Icon name="chevron-forward" size={14} tone="faint" />
      </Pressy>
      {pending.slice(0, 3).map((a) => <InvitationRow key={a.id} a={a} compact onDone={reload} />)}
    </View>
  );
}
