import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { BizHeader, Key, NoBusiness, Pill } from '../../components/BizUi';
import { PersonSearch } from '../../components/PersonSearch';
import { PersonCard, getProfiles } from '../../lib/api';
import { Customer, Stage, Task, addCustomer, addCustomerFromUser, addDays, addTask, crmSync, deleteCustomer, deleteTask, listCustomers, listTasks, setTaskDone, stages, startCustomerChat, startNegotiation, startOfDay, updateCustomer } from '../../lib/biz';
import { useCall } from '../../features/calls/CallProvider';
import { friendly } from '../../lib/errors';
import { WIDE } from '../../lib/layout';
import { useChats } from '../../state/ChatsProvider';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Button, Chip, Field, Icon, IconButton, IconName, Pressy, Sheet, Txt, useToast } from '../../ui';
import { loc, t as T, tr } from '../../i18n';

const ago = (iso: string | null) => {
  if (!iso) return 'sin contacto';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : T('hace {n} d', { n: d });
};

export default function Clients() {
  const { c, r } = useTheme();
  const { active } = useSpace();
  const { chats } = useChats();
  const call = useCall();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [sel, setSel] = useState<Customer | null>(null);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [taskText, setTaskText] = useState('');
  const [writing, setWriting] = useState<string | null>(null);
  // Photo and @username of the customers who have a CIFRA account (the team may see them).
  const [people, setPeople] = useState<Record<string, PersonCard>>({});
  const loadPeople = useCallback((cs: Customer[]) => { const ids = [...new Set(cs.map((x) => x.user_id).filter((x): x is string => !!x))]; if (ids.length) getProfiles(ids).then((p) => setPeople(Object.fromEntries(p.map((x) => [x.id, x])))).catch(() => {}); }, []);
  const avatarOf = (cu: Customer) => (cu.user_id ? people[cu.user_id]?.avatar_path ?? null : null);
  const bid = active?.business.id;
  const canWrite = active?.role !== 'viewer';

  const load = useCallback(async () => {
    if (!bid) return;
    try { if (canWrite) await crmSync(bid).catch(() => {}); const [cs, ts] = await Promise.all([listCustomers(bid), listTasks(bid)]); setRows(cs); setTasks(ts); loadPeople(cs); }
    catch (e) { setRows([]); toast.show(friendly(e), 'error'); }
  }, [bid, canWrite, loadPeople]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (rows ?? []).filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()) || x.tags.some((t) => t.includes(q.trim().toLowerCase())) || (x.phone ?? '').includes(q.trim())), [rows, q]);
  if (!active) return <NoBusiness onCreate={() => router.push('/business-create')} />;

  const patch = (cu: Customer, p: Partial<Customer>) => {
    setRows((cur) => cur?.map((x) => (x.id === cu.id ? { ...x, ...p } : x)) ?? cur);
    setSel((s) => (s && s.id === cu.id ? { ...s, ...p } : s));
    updateCustomer(cu.id, p as never).catch((e) => { toast.show(friendly(e), 'error'); load(); });
  };
  const chatFor = (cu: Customer) => chats.find((ch) => ch.peer_id && ch.peer_id === cu.user_id);
  const ring = async (cu: Customer, kind: 'audio' | 'video') => {
    if (!cu.user_id) return;
    setSel(null);
    await call.startCall({ id: cu.user_id, name: cu.name, avatar: avatarOf(cu) }, kind, { conversationId: chatFor(cu)?.id });
  };
  /** Group room with the customer (files, polls, group calls with screen sharing); reuses the one that already exists. */
  const negotiate = async (cu: Customer) => {
    if (!bid) return;
    try { const id = await startNegotiation(bid, cu.id); setSel(null); router.push({ pathname: '/chat/[id]', params: { id } }); } catch (e) { toast.show(friendly(e), 'error'); }
  };
  const openTasks = tasks.filter((t) => !t.done);
  /** "Escribir": opens the existing business chat or creates it (also when only the phone was known and that number is on CIFRA). */
  const write = async (cu: Customer) => {
    const existing = chatFor(cu);
    if (existing) { setSel(null); router.push({ pathname: '/chat/[id]', params: { id: existing.id } }); return; }
    if (!canWrite) return toast.show('Tu rol es de solo lectura en este negocio.', 'info');
    setWriting(cu.id);
    try {
      const id = await startCustomerChat(cu.id);
      setSel(null); load(); // the card may now be linked to the account
      router.push({ pathname: '/chat/[id]', params: { id } });
    } catch (e) {
      const msg = String((e as Error).message);
      toast.show(/customer_not_on_cifra/.test(msg) ? T('{name} aún no está en CIFRA con ese número. Invítale y podrás escribirle.', { name: cu.name }) : /customer_is_team/.test(msg) ? 'Esa persona es de tu equipo: escríbele desde tu espacio Personal.' : friendly(e, 'No se pudo abrir el chat.'), 'error');
    } finally { setWriting(null); }
  };
  const canChat = (cu: Customer) => !!cu.user_id || !!cu.phone?.trim();

  const card = (cu: Customer) => (
    <Pressy key={cu.id} onPress={() => setSel(cu)} accessibilityRole="button" scale={0.98} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ padding: 11, gap: 7, borderRadius: r(10), backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <Avatar name={cu.name} seed={cu.user_id ?? cu.id} path={avatarOf(cu)} size={30} />
        <View style={{ flex: 1 }}><Txt v="smallStrong" numberOfLines={1}>{cu.name}</Txt><Txt v="caption" tone="faint">{ago(cu.last_contact_at)}</Txt></View>
        {canChat(cu) && <IconButton icon={cu.user_id ? 'chatbubble-ellipses' : 'chatbubble-outline'} label={T('Escribir a {name}', { name: cu.name })} tone="accent" size={30} pop disabled={writing === cu.id} onPress={() => write(cu)} />}
      </View>
      {(cu.tags.length > 0 || cu.value_minor) ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          {cu.tags.slice(0, 3).map((t) => <View key={t} style={{ paddingHorizontal: 6, height: 20, borderRadius: 4, backgroundColor: c.sunken, justifyContent: 'center' }}><Txt style={{ fontSize: 11, lineHeight: 14, color: c.textMuted }}>#{t}</Txt></View>)}
          {cu.value_minor ? <Txt v="caption" style={{ color: c.success, marginLeft: 'auto' }}>{(cu.value_minor / 100).toLocaleString(loc())} €</Txt> : null}
        </View>
      ) : null}
    </Pressy>
  );

  const board = (
    <ScrollView horizontal showsHorizontalScrollIndicator={wide} contentContainerStyle={{ gap: 12, padding: 16, paddingTop: 4 }}>
      {stages.map((s) => {
        const list = filtered.filter((x) => x.stage === s.key);
        return (
          <View key={s.key} style={{ width: 252, borderRadius: r(12), backgroundColor: c.sunken, padding: 8, gap: 8, alignSelf: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 2 }}>
              <View style={{ width: 4, height: 16, borderRadius: 1, backgroundColor: s.color }} />
              <Txt v="smallStrong" style={{ flex: 1 }}>{s.label}</Txt><Txt v="mono" tone="faint">{list.length}</Txt>
            </View>
            {list.map(card)}
            {list.length === 0 && <Txt v="caption" tone="faint" style={{ textAlign: 'center', paddingVertical: 14 }}>Vacío</Txt>}
          </View>
        );
      })}
    </ScrollView>
  );

  const list = (
    <View style={{ padding: 16, paddingTop: 4, gap: 8 }}>
      {filtered.map((cu) => (
        <Pressy key={cu.id} onPress={() => setSel(cu)} accessibilityRole="button" scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: r(10), backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <Avatar name={cu.name} seed={cu.user_id ?? cu.id} path={avatarOf(cu)} size={40} />
          <View style={{ flex: 1 }}><Txt v="bodyStrong" numberOfLines={1}>{cu.name}</Txt><Txt v="caption" tone="muted" numberOfLines={1}>{[cu.phone, cu.email].filter(Boolean).join(' · ') || ago(cu.last_contact_at)}</Txt></View>
          <Pill label={stages.find((s) => s.key === cu.stage)!.label} color={stages.find((s) => s.key === cu.stage)!.color} />
          {canChat(cu) && <IconButton icon="chatbubble-ellipses-outline" label={T('Escribir a {name}', { name: cu.name })} tone="accent" size={36} pop disabled={writing === cu.id} onPress={() => write(cu)} />}
        </Pressy>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BizHeader eyebrow="CRM" title="Clientes" sub={rows ? T('{n} {w} · {m} tareas', { n: rows.length, w: tr(rows.length === 1 ? 'cliente' : 'clientes'), m: openTasks.length }) : undefined}
        right={<><Key icon={view === 'board' ? 'list' : 'albums'} onPress={() => setView(view === 'board' ? 'list' : 'board')} />{canWrite && <Key primary icon="add" label="Cliente" onPress={() => setAdding(true)} />}</>} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.highlight} />} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ padding: 16, paddingBottom: 10, gap: 12 }}>
          <Field value={q} onChangeText={setQ} placeholder="Buscar por nombre, #etiqueta o teléfono" icon="search" autoCapitalize="none" style={{ paddingVertical: 9 }} />
          <View style={{ borderRadius: r(12), borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: openTasks.length || canWrite ? 1 : 0, borderBottomColor: c.border }}>
              <Icon name="checkbox" size={17} color={c.highlight} /><Txt v="smallStrong" style={{ flex: 1 }}>Tareas pendientes</Txt><Txt v="mono" tone="faint">{openTasks.length}</Txt>
            </View>
            {openTasks.slice(0, 6).map((t) => {
              const cu = rows?.find((x) => x.id === t.customer_id);
              const overdue = t.due_at && new Date(t.due_at) < new Date();
              return (
                <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9 }}>
                  <Pressy onPress={() => { setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, done: true } : x))); setTaskDone(t.id, true).catch(() => load()); }} accessibilityRole="checkbox" accessibilityLabel={T('Completar {title}', { title: t.title })} scale={0.85} style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: c.borderStrong }} />
                  <View style={{ flex: 1 }}><Txt v="small" numberOfLines={1}>{t.title}</Txt>{(cu || t.due_at) && <Txt v="caption" style={{ color: overdue ? c.danger : c.textMuted }}>{[cu?.name, t.due_at && new Date(t.due_at).toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}</Txt>}</View>
                  <Pressy onPress={() => { setTasks((cur) => cur.filter((x) => x.id !== t.id)); deleteTask(t.id).catch(() => load()); }} accessibilityRole="button" accessibilityLabel="Borrar tarea" scale={0.85}><Icon name="close" size={16} tone="faint" /></Pressy>
                </View>
              );
            })}
            {canWrite && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: openTasks.length ? 1 : 0, borderTopColor: c.border }}>
                <View style={{ flex: 1 }}><Field value={taskText} onChangeText={setTaskText} placeholder="Nueva tarea… (Enter para añadir)" style={{ paddingVertical: 8 }} returnKeyType="done" onSubmitEditing={async () => { if (!taskText.trim() || !bid) return; try { const t = await addTask(bid, { title: taskText, due_at: addDays(startOfDay(new Date()), 1).toISOString() }); setTasks((cur) => [t, ...cur]); setTaskText(''); } catch (e) { toast.show(friendly(e), 'error'); } }} /></View>
              </View>
            )}
          </View>
        </View>
        {rows === null ? <Txt tone="muted" style={{ textAlign: 'center', padding: 30 }}>Cargando…</Txt> : rows.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 30, gap: 10 }}><Icon name="people-outline" size={34} tone="faint" /><Txt v="h3">Aún no tienes clientes</Txt><Txt tone="muted" style={{ textAlign: 'center', maxWidth: 340 }}>Cada persona que te escriba aparecerá aquí sola. También puedes añadir clientes a mano.</Txt>{canWrite && <Key primary icon="add" label="Añadir cliente" onPress={() => setAdding(true)} />}</View>
        ) : view === 'board' ? board : list}
      </ScrollView>

      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.name}>
        {sel && (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressy onPress={() => sel.user_id && router.push({ pathname: '/user/[id]', params: { id: sel.user_id } })} disabled={!sel.user_id} accessibilityRole="button" accessibilityLabel="Ver perfil" scale={0.96}><Avatar name={sel.name} seed={sel.user_id ?? sel.id} path={avatarOf(sel)} size={64} /></Pressy>
              <View style={{ flex: 1, gap: 2 }}>
                {sel.user_id && people[sel.user_id]?.username ? <Txt v="smallStrong" tone="accent">@{people[sel.user_id]?.username}</Txt> : <Txt v="caption" tone="faint">{sel.user_id ? 'Cuenta de CIFRA' : 'Sin cuenta de CIFRA'}</Txt>}
                <Txt v="caption" tone="faint">Último contacto: {ago(sel.last_contact_at)}</Txt>
              </View>
            </View>
            <DraftField key={`nm-${sel.id}`} label="Nombre" initial={sel.name} editable={canWrite} maxLength={80} autoCapitalize="words" onCommit={(t) => t.trim() && patch(sel, { name: t.trim() })} />
            <DraftField key={`ph-${sel.id}`} label="Teléfono" initial={sel.phone ?? ''} editable={canWrite} keyboardType="phone-pad" icon="call" placeholder="+34 600 123 456" maxLength={40} onCommit={(t) => patch(sel, { phone: t.trim() || null })} />
            <DraftField key={`em-${sel.id}`} label="Correo" initial={sel.email ?? ''} editable={canWrite} keyboardType="email-address" autoCapitalize="none" icon="mail" maxLength={200} onCommit={(t) => patch(sel, { email: t.trim() || null })} />
            <View style={{ gap: 8 }}>
              <Txt v="mono" tone="faint">ETAPA</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{stages.map((s) => <Chip key={s.key} label={s.label} icon={s.icon as IconName} active={sel.stage === s.key} onPress={() => canWrite && patch(sel, { stage: s.key as Stage })} />)}</View>
            </View>
            <TagEditor customer={sel} canWrite={canWrite} onChange={(tags) => patch(sel, { tags })} />
            <DraftField key={`v-${sel.id}`} label="Valor estimado (€)" initial={sel.value_minor != null ? String(sel.value_minor / 100) : ''} editable={canWrite} keyboardType="decimal-pad" placeholder="0" onCommit={(t) => { const n = parseFloat(t.replace(',', '.')); patch(sel, { value_minor: Number.isFinite(n) ? Math.round(n * 100) : null }); }} />
            <DraftField key={`n-${sel.id}`} label="Notas privadas" initial={sel.notes ?? ''} editable={canWrite} multiline placeholder="Preferencias, acuerdos, lo que no quieras olvidar" maxLength={1000} onCommit={(t) => patch(sel, { notes: t.trim() || null })} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {canChat(sel) ? <Key primary icon="chatbubble" label={chatFor(sel) ? 'Abrir chat' : 'Escribir'} onPress={() => write(sel)} /> : <Txt v="caption" tone="faint" style={{ alignSelf: 'center' }}>Añade su teléfono para poder escribirle</Txt>}
              {call.supported && sel.user_id && canWrite && <Key icon="call" label="Llamar" onPress={() => ring(sel, 'audio')} />}
              {call.supported && sel.user_id && canWrite && <Key icon="videocam" label="Videollamada" onPress={() => ring(sel, 'video')} />}
              {sel.user_id && canWrite && <Key icon="people" label="Sala de negociación" onPress={() => negotiate(sel)} />}
              <Key icon="calendar" label="Agendar cita" onPress={() => { setSel(null); router.push({ pathname: '/agenda', params: { customer: sel.id } }); }} />
              {canWrite && <Key icon="checkbox" label="Tarea" onPress={async () => { try { const t = await addTask(bid!, { title: T('Seguimiento: {name}', { name: sel.name }), customer_id: sel.id, due_at: addDays(startOfDay(new Date()), 2).toISOString() }); setTasks((cur) => [t, ...cur]); toast.show('Tarea creada para dentro de 2 días', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } }} />}
              {active.role !== 'agent' && active.role !== 'viewer' && <Key icon="trash" label="Eliminar" onPress={async () => { const id = sel.id; setSel(null); try { await deleteCustomer(id); setRows((cur) => cur?.filter((x) => x.id !== id) ?? cur); } catch (e) { toast.show(friendly(e), 'error'); } }} />}
            </View>
          </View>
        )}
      </Sheet>

      <AddCustomer visible={adding} onClose={() => setAdding(false)} exclude={(rows ?? []).map((x) => x.user_id).filter((x): x is string => !!x)}
        onPickUser={async (p) => {
          try {
            const id = await addCustomerFromUser(bid!, p.id); setAdding(false);
            const cs = await listCustomers(bid!); setRows(cs); loadPeople(cs);
            const cu = cs.find((x) => x.id === id); if (cu) setSel(cu); // straight to the card, so the contact can be completed
            toast.show(T('{name} añadido a tus clientes', { name: p.name }), 'success');
          } catch (e) { toast.show(/customer_is_team/.test(String((e as Error).message)) ? 'Esa persona es de tu equipo.' : friendly(e), 'error'); }
        }}
        onSave={async (v) => { try { const cu = await addCustomer(bid!, v); setRows((cur) => [cu, ...(cur ?? [])]); setAdding(false); setSel(cu); toast.show('Cliente añadido', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } }} />
    </View>
  );
}

/** Text field that saves when you leave it (not on every keystroke). */
function DraftField({ initial, onCommit, ...props }: { initial: string; onCommit: (t: string) => void } & Omit<React.ComponentProps<typeof Field>, 'value' | 'onChangeText'>) {
  const [t, setT] = useState(initial);
  return <Field {...props} value={t} onChangeText={setT} onBlur={() => { if (t !== initial) onCommit(t); }} />;
}

function TagEditor({ customer, canWrite, onChange }: { customer: Customer; canWrite: boolean; onChange: (t: string[]) => void }) {
  const { c } = useTheme();
  const [t, setT] = useState('');
  const add = () => { const v = t.trim().toLowerCase().replace(/[^a-z0-9áéíóúñ_-]/g, '').slice(0, 20); if (v && !customer.tags.includes(v)) onChange([...customer.tags, v]); setT(''); };
  return (
    <View style={{ gap: 8 }}>
      <Txt v="mono" tone="faint">ETIQUETAS</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {customer.tags.map((x) => <Pressy key={x} onPress={() => canWrite && onChange(customer.tags.filter((y) => y !== x))} accessibilityLabel={T('Quitar etiqueta {tag}', { tag: x })} scale={0.94} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 26, borderRadius: 5, backgroundColor: c.accentSoft }}><Txt v="caption" style={{ color: c.accentSoftText }}>#{x}</Txt>{canWrite && <Icon name="close" size={12} color={c.accentSoftText} />}</Pressy>)}
        {canWrite && <View style={{ minWidth: 130, flex: 1 }}><Field value={t} onChangeText={setT} placeholder="+ etiqueta (vip, mayorista…)" autoCapitalize="none" style={{ paddingVertical: 6, fontSize: 14 }} returnKeyType="done" onSubmitEditing={add} /></View>}
      </View>
    </View>
  );
}

function AddCustomer({ visible, onClose, onSave, onPickUser, exclude }: { visible: boolean; onClose: () => void; onSave: (v: { name: string; phone?: string; email?: string; stage: Stage; notes?: string }) => void; onPickUser: (p: { id: string; name: string }) => void; exclude: string[] }) {
  const [tab, setTab] = useState<'search' | 'manual'>('search');
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState(''); const [stage, setStage] = useState<Stage>('lead');
  useEffect(() => { if (visible) { setTab('search'); setName(''); setPhone(''); setEmail(''); setStage('lead'); } }, [visible]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Nuevo cliente">
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Chip label="Buscar en CIFRA" icon="at" active={tab === 'search'} onPress={() => setTab('search')} />
        <Chip label="A mano" icon="create" active={tab === 'manual'} onPress={() => setTab('manual')} />
      </View>
      {tab === 'search' ? (
        <View style={{ gap: 10 }}>
          <Txt v="small" tone="muted">Busca por @usuario o por teléfono: se añade con su nombre y su foto, y después puedes editar sus datos.</Txt>
          <PersonSearch autoFocus exclude={exclude} onPick={onPickUser} />
        </View>
      ) : (
      <View style={{ gap: 12 }}>
        <Field label="Nombre" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} />
        <Field label="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="call" />
        <Field label="Correo (opcional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{stages.map((s) => <Chip key={s.key} label={s.label} active={stage === s.key} onPress={() => setStage(s.key)} />)}</View>
        <Button title="Guardar cliente" disabled={!name.trim()} onPress={() => onSave({ name, phone, email, stage })} />
      </View>
      )}
    </Sheet>
  );
}
