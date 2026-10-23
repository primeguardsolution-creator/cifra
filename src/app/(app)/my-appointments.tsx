import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { InvitationRow, useMyAppointments, when } from '../../features/agenda/Invitations';
import { MyAppointment, apptMeta } from '../../lib/biz';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, EmptyState, Icon, IconButton, Pressy, Txt } from '../../ui';

/** Personal space: the appointments businesses hold with you (invitations to answer + accepted ones). */
export default function MyAppointments() {
  const { c, r } = useTheme();
  const { rows, pending, upcoming, reload } = useMyAppointments();
  const [refreshing, setRefreshing] = useState(false);
  const past = (rows ?? []).filter((a) => !pending.includes(a) && !upcoming.includes(a));
  const row = (a: MyAppointment) => (
    <Pressy key={a.id} onPress={() => a.conversation_id && router.push({ pathname: '/chat/[id]', params: { id: a.conversation_id } })} accessibilityRole="button" scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: r(16), backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
      <Avatar name={a.business_name} seed={a.business_id} path={a.logo_path} size={44} business />
      <View style={{ flex: 1 }}>
        <Txt v="bodyStrong" numberOfLines={1}>{a.title}</Txt>
        <Txt v="small" tone="muted" numberOfLines={1}>{a.business_name} · {when(a)}</Txt>
        {a.notes ? <Txt v="caption" tone="faint" numberOfLines={1}>{a.notes}</Txt> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: `${apptMeta[a.status].color}26` }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: apptMeta[a.status].color }} /><Txt v="caption" style={{ color: apptMeta[a.status].color }}>{apptMeta[a.status].label}</Txt></View>
    </Pressy>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 6 }}>
        <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} />
        <Txt v="h2" style={{ flex: 1 }}>Mis citas</Txt>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={c.accent} />}>
        {rows !== null && rows.length === 0 && <EmptyState icon="calendar" title="Aún no tienes citas" body="Cuando un negocio te invite a una cita o aceptes una solicitud, aparecerá aquí." />}
        {pending.length > 0 && (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="notifications" size={14} color={c.highlight} /><Txt v="mono" tone="faint">INVITACIONES POR RESPONDER</Txt></View>
            {pending.map((a) => <InvitationRow key={a.id} a={a} onDone={reload} />)}
          </View>
        )}
        {upcoming.length > 0 && <View style={{ gap: 8 }}><Txt v="mono" tone="faint">PRÓXIMAS</Txt>{upcoming.map(row)}</View>}
        {past.length > 0 && <View style={{ gap: 8 }}><Txt v="mono" tone="faint">ANTERIORES Y SOLICITUDES</Txt>{past.map(row)}</View>}
      </ScrollView>
    </SafeAreaView>
  );
}
