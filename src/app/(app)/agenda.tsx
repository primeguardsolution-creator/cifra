import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { BizHeader, Key, NoBusiness, Pill } from '../../components/BizUi';
import { SlotPicker } from '../../components/SlotPicker';
import { Appointment, ApptStatus, Customer, addDays, apptMeta, createAppointment, crmSync, hm, listAppointments, listCustomers, listRequestedAppointments, longDay, sameDay, startOfDay, updateAppointment } from '../../lib/biz';
import { TeamMember, listTeam } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { WIDE } from '../../lib/layout';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { font } from '../../theme/tokens';
import { Chip, Field, Icon, Pressy, Sheet, Txt, useToast, Button } from '../../ui';
import { loc, t } from '../../i18n';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const QUICK_TITLES = ['Consulta', 'Reunión', 'Visita', 'Llamada', 'Revisión', 'Demostración'];

function monthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const start = addDays(first, -lead);
  return { start, days: Array.from({ length: 42 }, (_, i) => addDays(start, i)) };
}

export default function Agenda() {
  const { c, r } = useTheme();
  const { active } = useSpace();
  const { user } = useAuth();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE + 200;
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [items, setItems] = useState<Appointment[]>([]);
  const [requests, setRequests] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);
  const bid = active?.business.id;
  const canWrite = active?.role !== 'viewer';
  const grid = useMemo(() => monthGrid(anchor), [anchor]);

  const load = useCallback(async () => {
    if (!bid) return;
    try {
      const [list, reqs] = await Promise.all([listAppointments(bid, grid.start, addDays(grid.start, 42)), listRequestedAppointments(bid)]);
      setItems(list); setRequests(reqs);
    } catch (e) { toast.show(friendly(e), 'error'); }
  }, [bid, grid.start]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!bid) return;
    (async () => { try { if (canWrite) await crmSync(bid).catch(() => {}); setCustomers(await listCustomers(bid)); setTeam(await listTeam(bid)); } catch { /* optional data */ } })();
  }, [bid, canWrite]);

  if (!active) return <NoBusiness onCreate={() => router.push('/business-create')} />;

  const nameOf = (a: Appointment) => customers.find((x) => x.id === a.customer_id)?.name ?? null;
  const byDay = (d: Date) => items.filter((a) => sameDay(new Date(a.starts_at), d) && a.status !== 'cancelled');
  const dayItems = byDay(selected);
  const monthLabel = anchor.toLocaleDateString(loc(), { month: 'long', year: 'numeric' });
  const shift = (n: number) => { const d = new Date(anchor.getFullYear(), anchor.getMonth() + n, 1); setAnchor(d); };
  const today = startOfDay(new Date());

  const act = async (id: string, status: ApptStatus, msg: string) => {
    try { await updateAppointment(id, { status }); toast.show(msg, 'success'); setOpen(null); load(); } catch (e) { toast.show(friendly(e), 'error'); }
  };

  const calendar = (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: r(14), backgroundColor: c.surface, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Key icon="chevron-back" small onPress={() => shift(-1)} />
        <Txt v="h3" style={{ flex: 1, textAlign: 'center' }}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Txt>
        <Key icon="chevron-forward" small onPress={() => shift(1)} />
      </View>
      <View style={{ flexDirection: 'row' }}>{DOW.map((d) => <Txt key={d} v="mono" tone="faint" style={{ flex: 1, textAlign: 'center', paddingVertical: 7 }}>{d}</Txt>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {grid.days.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const list = byDay(d);
          const isSel = sameDay(d, selected);
          const isToday = sameDay(d, today);
          return (
            <Pressy key={d.toISOString()} onPress={() => setSelected(startOfDay(d))} accessibilityRole="button" accessibilityLabel={t('{day}, {n} citas', { day: longDay(d), n: list.length })} scale={0.96}
              style={{ width: `${100 / 7}%`, aspectRatio: wide ? 1.25 : width >= 700 ? 1.9 : 1, padding: 4, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: isSel ? c.accentSoft : 'transparent' }}>
              <View style={{ alignSelf: 'flex-start', minWidth: 24, height: 24, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? c.highlight : 'transparent' }}>
                <Txt style={{ fontSize: 13, lineHeight: 16, fontFamily: isToday || isSel ? font.bold : font.medium, color: isToday ? '#16160F' : inMonth ? c.text : c.textFaint }}>{d.getDate()}</Txt>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                {list.slice(0, 4).map((a) => <View key={a.id} style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: apptMeta[a.status].color }} />)}
                {list.length > 4 && <Txt style={{ fontSize: 9, lineHeight: 8, color: c.textMuted }}>+{list.length - 4}</Txt>}
              </View>
            </Pressy>
          );
        })}
      </View>
    </View>
  );

  const agenda = (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt v="h3" style={{ flex: 1 }}>{sameDay(selected, today) ? 'Hoy' : longDay(selected).charAt(0).toUpperCase() + longDay(selected).slice(1)}</Txt>
        <Txt v="mono" tone="faint">{dayItems.length} {dayItems.length === 1 ? 'CITA' : 'CITAS'}</Txt>
      </View>
      {dayItems.length === 0 ? (
        <View style={{ padding: 22, alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, borderRadius: r(14) }}>
          <Icon name="calendar-outline" size={26} tone="faint" /><Txt tone="muted" style={{ textAlign: 'center' }}>Día libre. {canWrite ? 'Toca «Nueva cita» para agendar algo.' : ''}</Txt>
        </View>
      ) : dayItems.map((a) => (
        <Pressy key={a.id} onPress={() => setOpen(a)} accessibilityRole="button" scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', borderRadius: r(14), backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
          <View style={{ width: 5, backgroundColor: apptMeta[a.status].color }} />
          <View style={{ width: 64, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
            <Txt style={{ fontFamily: font.display, fontSize: 17, lineHeight: 20 }}>{hm(a.starts_at)}</Txt><Txt v="caption" tone="faint">{hm(a.ends_at)}</Txt>
          </View>
          <View style={{ flex: 1, paddingVertical: 12, paddingRight: 12, gap: 4 }}>
            <Txt v="bodyStrong" numberOfLines={1}>{a.title}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Pill label={apptMeta[a.status].label} color={apptMeta[a.status].color} />
              {nameOf(a) && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="person" size={12} tone="faint" /><Txt v="caption" tone="muted">{nameOf(a)}</Txt></View>}
            </View>
          </View>
        </Pressy>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BizHeader eyebrow="Agenda" title="Citas" sub={`${active.business.name}`} right={<><Key icon="today" label="Hoy" onPress={() => { setAnchor(today); setSelected(today); }} />{canWrite && <Key primary icon="add" label="Nueva cita" onPress={() => setCreating(true)} />}</>} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.highlight} />}>
        {requests.length > 0 && (
          <View style={{ borderRadius: r(14), borderWidth: 1.5, borderColor: c.highlight, backgroundColor: c.accentSoft, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="notifications" size={16} color={c.highlight} /><Txt v="smallStrong" style={{ color: c.accentSoftText }}>{requests.length} {requests.length === 1 ? 'solicitud de cita' : 'solicitudes de cita'} por responder</Txt></View>
            {requests.slice(0, 4).map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, padding: 10, borderRadius: r(10), borderWidth: 1, borderColor: c.border }}>
                <View style={{ flex: 1 }}><Txt v="smallStrong" numberOfLines={1}>{nameOf(a) ?? 'Cliente'} · {new Date(a.starts_at).toLocaleString(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Txt>{a.notes ? <Txt v="caption" tone="muted" numberOfLines={1}>{a.notes}</Txt> : null}</View>
                <Key small icon="checkmark" label="Aceptar" primary onPress={() => act(a.id, 'scheduled', 'Cita aceptada · avisamos al cliente')} />
                <Key small icon="close" onPress={() => act(a.id, 'cancelled', 'Solicitud rechazada')} />
              </View>
            ))}
          </View>
        )}
        {wide ? <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}><View style={{ flex: 3 }}>{calendar}</View><View style={{ flex: 2 }}>{agenda}</View></View> : <>{calendar}{agenda}</>}
      </ScrollView>

      <NewAppointment visible={creating} onClose={() => setCreating(false)} bid={active.business.id} customers={customers} team={team} me={user?.id ?? ''} day={selected} onDone={() => { setCreating(false); load(); }} />

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.title}>
        {open && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Pill label={apptMeta[open.status].label} color={apptMeta[open.status].color} />
              <Txt v="small" tone="muted">{new Date(open.starts_at).toLocaleString(loc(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} – {hm(open.ends_at)}</Txt>
            </View>
            {nameOf(open) && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="person" size={16} tone="accent" /><Txt>{nameOf(open)}</Txt></View>}
            {open.notes ? <Txt tone="muted">{open.notes}</Txt> : null}
            {canWrite && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {open.status === 'requested' && <Key primary icon="checkmark" label="Aceptar" onPress={() => act(open.id, 'scheduled', 'Cita aceptada')} />}
                {(open.status === 'scheduled' || open.status === 'requested') && <Key icon="checkmark-done" label="Marcar confirmada" onPress={() => act(open.id, 'confirmed', 'Cita confirmada')} />}
                {['scheduled', 'confirmed'].includes(open.status) && <Key icon="ribbon" label="Hecha" onPress={() => act(open.id, 'done', 'Cita completada')} />}
                {['scheduled', 'confirmed'].includes(open.status) && <Key icon="eye-off" label="No vino" onPress={() => act(open.id, 'no_show', 'Marcada como «no vino»')} />}
                {open.status !== 'cancelled' && open.status !== 'done' && <Key icon="close-circle" label="Cancelar" onPress={() => act(open.id, 'cancelled', 'Cita cancelada · avisamos al cliente')} />}
              </View>
            )}
            {open.conversation_id && <Key icon="chatbubble" label="Abrir conversación" onPress={() => { const id = open.conversation_id!; setOpen(null); router.push({ pathname: '/chat/[id]', params: { id } }); }} />}
            {canWrite && ['scheduled', 'confirmed', 'requested'].includes(open.status) && <Reschedule appt={open} onDone={() => { setOpen(null); load(); toast.show('Cita reprogramada', 'success'); }} />}
          </View>
        )}
      </Sheet>
    </View>
  );
}

function Reschedule({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const toast = useToast();
  const [slot, setSlot] = useState<Date | null>(null);
  const [show, setShow] = useState(false);
  if (!show) return <Key icon="time" label="Cambiar fecha u hora" onPress={() => setShow(true)} />;
  return (
    <View style={{ gap: 10 }}>
      <SlotPicker value={slot} onChange={setSlot} />
      <Button title="Guardar nueva fecha" disabled={!slot} onPress={async () => { try { await updateAppointment(appt.id, { start: slot! }); onDone(); } catch (e) { toast.show(friendly(e), 'error'); } }} />
    </View>
  );
}

function NewAppointment({ visible, onClose, bid, customers, team, me, day, onDone }: { visible: boolean; onClose: () => void; bid: string; customers: Customer[]; team: TeamMember[]; me: string; day: Date; onDone: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [cust, setCust] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [slot, setSlot] = useState<Date | null>(null);
  const [mins, setMins] = useState(30);
  const [notes, setNotes] = useState('');
  const [who, setWho] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setTitle(''); setCust(null); setQ(''); setMins(30); setNotes(''); setWho(null); const d = new Date(day); d.setHours(Math.max(9, new Date().getHours() + 1), 0, 0, 0); setSlot(d.getTime() < Date.now() ? null : d); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = customers.filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6);
  const save = async () => {
    if (!slot || !title.trim()) return;
    setBusy(true);
    try { await createAppointment({ business: bid, customer: cust, title, start: slot, end: new Date(slot.getTime() + mins * 60000), notes, assigned: who }); toast.show(cust && customers.find((x) => x.id === cust)?.user_id ? 'Cita agendada · el cliente la verá en su chat' : 'Cita agendada', 'success'); onDone(); }
    catch (e) { toast.show(/appointment_overlap/.test(String((e as Error).message)) ? 'Esa persona ya tiene una cita a esa hora.' : friendly(e, 'No se pudo agendar.'), 'error'); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Nueva cita">
      <View style={{ gap: 14 }}>
        <View style={{ gap: 8 }}>
          <Field label="¿Qué es?" value={title} onChangeText={setTitle} placeholder="Consulta, visita, reunión…" maxLength={80} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{QUICK_TITLES.map((t) => <Chip key={t} label={t} active={title === t} onPress={() => setTitle(t)} />)}</ScrollView>
        </View>
        <View style={{ gap: 8 }}>
          <Txt v="caption" tone="muted">Cliente (opcional) · se le avisa por el chat</Txt>
          <Field value={q} onChangeText={setQ} placeholder="Buscar cliente" icon="search" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip label="Sin cliente" active={cust === null} onPress={() => setCust(null)} />
            {shown.map((x) => <Chip key={x.id} label={x.name} icon={x.user_id ? 'chatbubble' : 'person'} active={cust === x.id} onPress={() => setCust(x.id)} />)}
          </View>
        </View>
        <View style={{ gap: 8 }}><Txt v="caption" tone="muted">Día y hora</Txt><SlotPicker value={slot} onChange={setSlot} /></View>
        <View style={{ gap: 8 }}><Txt v="caption" tone="muted">Duración</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{DURATIONS.map((m) => <Chip key={m} label={m >= 60 ? t('{n} h', { n: m / 60 === Math.floor(m / 60) ? m / 60 : (m / 60).toFixed(1) }) : t('{n} min', { n: m })} active={mins === m} onPress={() => setMins(m)} />)}</View></View>
        {team.length > 1 && (
          <View style={{ gap: 8 }}><Txt v="caption" tone="muted">Atiende</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}><Chip label="Cualquiera" active={who === null} onPress={() => setWho(null)} />{team.filter((t) => t.role !== 'viewer').map((t) => <Chip key={t.user_id} label={t.user_id === me ? 'Yo' : t.display_name} active={who === t.user_id} onPress={() => setWho(t.user_id)} />)}</View></View>
        )}
        <Field label="Notas (opcional)" value={notes} onChangeText={setNotes} multiline maxLength={300} />
        <Button title={slot ? t('Agendar · {when}', { when: slot.toLocaleString(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : 'Elige día y hora'} disabled={!slot || !title.trim()} loading={busy} onPress={save} />
      </View>
    </Sheet>
  );
}
