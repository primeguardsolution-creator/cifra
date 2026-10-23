import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Business, ContactRow, PersonCard, UserHit, createGroup, findUserByPhone, findUserByUsername, listContacts, saveContact, searchBusinesses, searchUsers, startDirectChat } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { Country, countries, countryMatches, countryName, flag, formatPhone, toE164 } from '../../lib/phone';
import { appUrl, inviteMessage, shareText } from '../../lib/share';
import { useAuth } from '../../state/AuthProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { BotAvatar } from '../../features/assistant/BotAvatar';
import { BOT } from '../../features/assistant/knowledge';
import { Avatar, Button, Chip, EmptyState, Field, Icon, IconButton, Pressy, Sheet, Txt, useToast } from '../../ui';
import { t, tr } from '../../i18n';

type Tab = 'phone' | 'group' | 'business';

export default function NewChat() {
  const { c } = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const { q: presetQ, mode: presetMode } = useLocalSearchParams<{ q?: string; mode?: string }>();
  const [tab, setTab] = useState<Tab>('phone');
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => { listContacts().then(setContacts).catch(() => {}); }, []);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/chats'));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 520, gap: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <IconButton icon="close" label="Cerrar" onPress={back} />
              <Txt v="h3">Nuevo chat</Txt>
              <View style={{ width: 40 }} />
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: c.sunken, borderRadius: radius.md, padding: 4 }}>
              {([['phone', 'Por número', 'call'], ['group', 'Grupo', 'people'], ['business', 'Negocios', 'storefront']] as const).map(([k, label, icon]) => (
                <Pressy key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} scale={0.98} style={{ flex: 1, height: 40, borderRadius: radius.md - 4, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === k ? c.surface : 'transparent' }}>
                  <Icon name={icon} size={15} tone={tab === k ? 'accent' : 'muted'} /><Txt v="smallStrong" tone={tab === k ? 'text' : 'muted'}>{label}</Txt>
                </Pressy>
              ))}
            </View>
            {tab === 'phone' && <ByPhone presetQ={presetQ} presetMode={presetMode === 'user' ? 'user' : undefined} contacts={contacts} myId={user?.id ?? ''} onSaved={(r) => setContacts((x) => [...x.filter((y) => y.contact_user_id !== r.contact_user_id), r])} toast={toast.show} />}
            {tab === 'group' && <NewGroup contacts={contacts} toast={toast.show} />}
            {tab === 'business' && <FindBusiness />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ByPhone({ presetQ, presetMode, contacts, myId, onSaved, toast }: { presetQ?: string; presetMode?: 'user'; contacts: ContactRow[]; myId: string; onSaved: (c: ContactRow) => void; toast: (m: string, k?: 'info' | 'success' | 'error') => void }) {
  const { c } = useTheme();
  const [country, setCountry] = useState<Country>(countries[0]);
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(PersonCard & { is_self: boolean }) | 'none' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookedUp, setLookedUp] = useState<string>('');
  const [mode, setMode] = useState<'phone' | 'user'>(presetQ || presetMode === 'user' ? 'user' : 'phone');
  const [handle, setHandle] = useState((presetQ ?? '').replace(/^@/, '').replace(/[^A-Za-z0-9_-]/g, ''));
  const [botHit, setBotHit] = useState(false);
  const [bizHits, setBizHits] = useState<Awaited<ReturnType<typeof searchBusinesses>>>([]);
  const [more, setMore] = useState<UserHit[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const isContact = (id: string) => saved.has(id) || contacts.some((x) => x.contact_user_id === id);

  const search = async () => {
    setError(null); setResult(null); setBotHit(false); setBizHits([]); setMore([]);
    if (mode === 'user') {
      const u = handle.trim().replace(/^@/, '');
      if (!/^[A-Za-z0-9_-]{2,48}$/.test(u)) return setError('Escribe el @usuario de una persona o el @identificador de un negocio.');
      if (u.toLowerCase() === BOT.username) return setBotHit(true);
      setBusy(true);
      try {
        // People and businesses share the @ search: a normal account can find any public business by its handle, contact or not.
        // The exact @username comes first; accounts that start with what was typed are listed below it.
        const [people, shops, prefix] = await Promise.all([
          /^[A-Za-z0-9_]{3,32}$/.test(u) ? findUserByUsername(u) : Promise.resolve([]), searchBusinesses(u),
          /^[A-Za-z0-9_]{2,32}$/.test(u) ? searchUsers(u).catch(() => [] as UserHit[]) : Promise.resolve([] as UserHit[]),
        ]);
        const exact = shops.filter((b) => b.handle === u.toLowerCase());
        const shown = exact.length ? exact : shops.filter((b) => b.handle?.startsWith(u.toLowerCase())).slice(0, 4);
        const rest = prefix.filter((p) => p.id !== people[0]?.id);
        setLookedUp(''); setBizHits(shown); setMore(rest); setResult(people[0] ?? (shown.length || rest.length ? null : 'none'));
      } catch (e) { setError(friendly(e)); } finally { setBusy(false); }
      return;
    }
    const p = toE164(country, phone);
    if (!p.ok) return setError(p.reason);
    setBusy(true);
    try { const rows = await findUserByPhone(p.e164); setLookedUp(p.e164); setResult(rows[0] ?? 'none'); } catch (e) { setError(friendly(e)); } finally { setBusy(false); }
  };

  useEffect(() => { if (presetQ) search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addContact = async (person: Pick<PersonCard, 'id' | 'display_name' | 'phone'>) => {
    setBusy(true);
    try {
      await saveContact(myId, { display_name: person.display_name, phone: person.phone ?? (lookedUp || null), contact_user_id: person.id });
      setSaved((s) => new Set(s).add(person.id));
      listContacts().then((cs) => cs.forEach(onSaved)).catch(() => {});
      toast(t('{name} añadido a tus contactos', { name: person.display_name }), 'success');
    } catch (e) { toast(friendly(e), 'error'); } finally { setBusy(false); }
  };
  const open = async (person: PersonCard) => {
    setBusy(true);
    try {
      const id = await startDirectChat(person.id);
      {
        saveContact(myId, { display_name: person.display_name, phone: person.phone ?? (lookedUp || null), contact_user_id: person.id }).then(() => listContacts().then((cs) => cs.forEach(onSaved))).catch(() => {});
      }
      router.replace({ pathname: '/chat/[id]', params: { id } });
    } catch (e) { toast(friendly(e), 'error'); } finally { setBusy(false); }
  };

  const filtered = q.trim() ? countries.filter((x) => countryMatches(x, q)) : countries;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Por teléfono" icon="call" active={mode === 'phone'} onPress={() => { setMode('phone'); setResult(null); setError(null); }} />
        <Chip label="Por @usuario" icon="at" active={mode === 'user'} onPress={() => { setMode('user'); setResult(null); setError(null); }} />
      </View>
      <Txt tone="muted">{mode === 'phone' ? 'Escribe el número completo de la persona. Solo la encontrarás si ya tiene cuenta en CIFRA.' : 'Pide a tu contacto su @usuario: así chateáis sin compartir ningún número de teléfono.'}</Txt>
      {mode === 'phone' ? (
        <Field value={phone} onChangeText={(t) => { setPhone(t); setResult(null); }} keyboardType="phone-pad" placeholder="600 123 456" returnKeyType="search" onSubmitEditing={search} error={error}
          left={<Pressy onPress={() => setPick(true)} accessibilityRole="button" accessibilityLabel={t('País: {name}', { name: countryName(country) })} scale={0.94} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, borderRightWidth: 1, borderRightColor: c.border, height: 28 }}><Txt style={{ fontSize: 20 }}>{flag(country.iso)}</Txt><Txt v="bodyStrong">+{country.dial}</Txt><Icon name="chevron-down" size={14} tone="muted" /></Pressy>} />
      ) : (
        <Field value={handle} onChangeText={(t) => { setHandle(t.replace(/^@/, '').replace(/[^A-Za-z0-9_-]/g, '')); setResult(null); setBizHits([]); }} autoCapitalize="none" autoCorrect={false} placeholder="usuario" returnKeyType="search" onSubmitEditing={search} error={error} left={<Txt tone="muted" style={{ fontSize: 18 }}>@</Txt>} />
      )}
      <Button title="Buscar" icon="search" loading={busy && !result} onPress={search} disabled={mode === 'phone' ? !phone.trim() : !handle.trim()} />

      {botHit && <BotCard />}
      {bizHits.map((b) => (
        <Pressy key={b.id} onPress={() => router.push({ pathname: '/b/[id]', params: { id: b.id } })} accessibilityRole="button" scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <Avatar name={b.name} path={b.logo_path} seed={b.id} size={52} business />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt v="bodyStrong" numberOfLines={1}>{b.name}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="storefront" size={12} tone="accent" /><Txt v="caption" tone="muted" numberOfLines={1}>Business · @{b.handle}{b.category ? ` · ${b.category}` : ''}</Txt></View>
          </View>
          <Icon name="chevron-forward" size={18} tone="faint" />
        </Pressy>
      ))}

      {result && result !== 'none' && (
        <View style={{ padding: 16, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={result.display_name} seed={result.id} path={result.avatar_path} size={56} />
            <View style={{ flex: 1 }}>
              <Txt v="h3" numberOfLines={1}>{result.display_name}</Txt>
              <Txt v="small" tone="muted" numberOfLines={1}>{mode === 'user' ? `@${handle.trim().replace(/^@/, '').toLowerCase()}` : result.phone ? formatPhone(result.phone) : 'Número oculto'}{isContact(result.id) ? ' · En tus contactos' : ''}</Txt>
            </View>
          </View>
          {result.is_self ? <Txt v="small" tone="muted">{mode === 'user' ? 'Es tu propio @usuario.' : 'Es tu propio número.'}</Txt> : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Chatear" icon="chatbubble" style={{ flex: 1 }} onPress={() => open(result)} loading={busy} />
              {!isContact(result.id) && <Button title="Añadir a contactos" icon="person-add" variant="soft" style={{ flex: 1 }} disabled={busy} onPress={() => addContact(result)} />}
            </View>
          )}
        </View>
      )}
      {more.length > 0 && (
        <View style={{ gap: 4 }}>
          <Txt v="mono" tone="faint" style={{ marginLeft: 4, marginBottom: 6 }}>{result && result !== 'none' ? 'OTRAS CUENTAS QUE EMPIEZAN IGUAL' : 'CUENTAS QUE EMPIEZAN ASÍ'}</Txt>
          {more.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <Avatar name={p.display_name} seed={p.id} path={p.avatar_path} size={44} />
              <View style={{ flex: 1 }}><Txt v="bodyStrong" numberOfLines={1}>{p.display_name}{p.is_self ? ' (tú)' : ''}</Txt><Txt v="caption" tone="muted">@{p.username}{p.is_contact || isContact(p.id) ? ' · En tus contactos' : ''}</Txt></View>
              {!p.is_self && !(p.is_contact || isContact(p.id)) && <IconButton icon="person-add-outline" label={t('Añadir a {name} a contactos', { name: p.display_name })} tone="accent" size={38} pop disabled={busy} onPress={() => addContact({ id: p.id, display_name: p.display_name, phone: null })} />}
              {!p.is_self && <IconButton icon="chatbubble" label={t('Chatear con {name}', { name: p.display_name })} tone="accent" size={38} disabled={busy} onPress={() => open({ id: p.id, display_name: p.display_name, avatar_path: p.avatar_path, phone: null })} />}
            </View>
          ))}
        </View>
      )}
      {result === 'none' && bizHits.length === 0 && more.length === 0 && (
        <View style={{ padding: 18, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 10 }}>
          <Txt v="bodyStrong">{mode === 'user' ? t('@{handle} no existe en CIFRA', { handle: handle.replace(/^@/, '') }) : t('{phone} aún no está en CIFRA', { phone: formatPhone(lookedUp) })}</Txt>
          <Txt v="small" tone="muted">Invítale a unirse y podréis chatear en cuanto cree su cuenta.</Txt>
          <Button title="Invitar a CIFRA" variant="soft" icon="share-social" onPress={async () => toast((await shareText(inviteMessage, appUrl())) === 'copied' ? 'Invitación copiada' : 'Invitación enviada', 'success')} />
        </View>
      )}

      {!result && !botHit && bizHits.length === 0 && more.length === 0 && (
        <Pressy onPress={() => router.replace('/assistant')} accessibilityRole="button" accessibilityLabel="Hablar con Maestro CIFRA, el asistente" scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 18, backgroundColor: c.accentSoft }}>
          <BotAvatar size={46} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Txt v="bodyStrong" style={{ color: c.accentSoftText }}>{BOT.name}</Txt><Icon name="checkmark-circle" size={15} tone="accent" /></View>
            <Txt v="caption" style={{ color: c.accentSoftText }}>@{BOT.username} · ¿Dudas? Te explico cómo hacer cualquier cosa</Txt>
          </View>
          <Icon name="chevron-forward" size={18} color={c.accentSoftText} />
        </Pressy>
      )}

      {contacts.length > 0 && !result && !botHit && bizHits.length === 0 && more.length === 0 && (
        <View style={{ gap: 4, marginTop: 8 }}>
          <Txt v="mono" tone="faint" style={{ marginLeft: 4, marginBottom: 6 }}>TUS CONTACTOS</Txt>
          {contacts.filter((x) => x.contact_user_id).map((x) => (
            <Pressy key={x.id} onPress={() => open({ id: x.contact_user_id!, display_name: x.display_name, avatar_path: null, phone: x.phone })} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: 14 }}>
              <Avatar name={x.display_name} seed={x.contact_user_id!} size={44} />
              <View style={{ flex: 1 }}><Txt v="bodyStrong">{x.display_name}</Txt><Txt v="caption" tone="muted">{x.phone ? formatPhone(x.phone) : 'Contacto por @usuario'}</Txt></View>
            </Pressy>
          ))}
        </View>
      )}

      <Sheet visible={pick} onClose={() => setPick(false)} title="Elige el país" scroll={false} maxHeight={560}>
        <Field value={q} onChangeText={setQ} placeholder="Buscar país o prefijo" icon="search" />
        <ScrollView style={{ maxHeight: 400, marginTop: 10 }} keyboardShouldPersistTaps="handled">
          {filtered.map((x) => (
            <Pressy key={x.iso + x.dial} onPress={() => { setCountry(x); setPick(false); setQ(''); }} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12 }}>
              <Txt style={{ fontSize: 24 }}>{flag(x.iso)}</Txt><Txt v="bodyStrong" style={{ flex: 1 }}>{countryName(x)}</Txt><Txt tone="muted">+{x.dial}</Txt>
            </Pressy>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

function BotCard() {
  const { c } = useTheme();
  return (
    <View style={{ padding: 16, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <BotAvatar size={56} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Txt v="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{BOT.name}</Txt><Icon name="checkmark-circle" size={17} tone="accent" /></View>
          <Txt v="small" tone="muted">@{BOT.username} · bot oficial</Txt>
        </View>
      </View>
      <Button title="Chatear" icon="chatbubble" onPress={() => router.replace('/assistant')} />
    </View>
  );
}

function NewGroup({ contacts, toast }: { contacts: ContactRow[]; toast: (m: string, k?: 'info' | 'success' | 'error') => void }) {
  const { c } = useTheme();
  const [title, setTitle] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const people = contacts.filter((x) => x.contact_user_id);
  const toggle = (id: string) => setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const create = async () => {
    setBusy(true);
    try { const id = await createGroup(title, chosen); router.replace({ pathname: '/chat/[id]', params: { id } }); } catch (e) { toast(friendly(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 14 }}>
      <Field label="Nombre del grupo" value={title} onChangeText={setTitle} placeholder="Familia, Equipo, Viaje…" maxLength={80} />
      <Txt v="mono" tone="faint" style={{ marginLeft: 4 }}>PARTICIPANTES · {chosen.length}</Txt>
      {people.length === 0 ? <EmptyState icon="people" title="Aún no tienes contactos" body="Empieza un chat por número y esa persona se guardará aquí para añadirla a grupos." /> : people.map((x) => {
        const on = chosen.includes(x.contact_user_id!);
        return (
          <Pressy key={x.id} onPress={() => toggle(x.contact_user_id!)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: 14 }}>
            <Avatar name={x.display_name} seed={x.contact_user_id!} size={44} />
            <View style={{ flex: 1 }}><Txt v="bodyStrong">{x.display_name}</Txt><Txt v="caption" tone="muted">{formatPhone(x.phone)}</Txt></View>
            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? c.accent : c.borderStrong, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on && <Icon name="checkmark" size={15} color={c.accentText} />}</View>
          </Pressy>
        );
      })}
      <Button title="Crear grupo" size="lg" loading={busy} disabled={!title.trim() || chosen.length === 0} onPress={create} />
    </View>
  );
}

function FindBusiness() {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Awaited<ReturnType<typeof searchBusinesses>>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const run = useCallback(async (text: string) => {
    const mine = ++seq.current;
    if (text.trim().length < 2) { setRows([]); setBusy(false); return; }
    setBusy(true);
    try { const r = await searchBusinesses(text.replace(/^@/, '')); if (mine === seq.current) { setRows(r); setError(null); } } catch (e) { if (mine === seq.current) setError(friendly(e)); } finally { if (mine === seq.current) setBusy(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => run(q), 350); return () => clearTimeout(t); }, [q, run]);
  return (
    <View style={{ gap: 14 }}>
      <Txt tone="muted">Encuentra negocios por su nombre o identificador y escríbeles directamente.</Txt>
      <Field value={q} onChangeText={setQ} placeholder="Nombre o @identificador" icon="search" autoCapitalize="none" right={busy ? <ActivityIndicator color={c.accent} /> : undefined} error={error} />
      {rows.map((b: Pick<Business, 'id' | 'name' | 'handle' | 'category' | 'description' | 'logo_path'>) => (
        <Pressy key={b.id} onPress={() => router.push({ pathname: '/b/[id]', params: { id: b.id } })} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <Avatar name={b.name} path={b.logo_path} seed={b.id} size={52} business />
          <View style={{ flex: 1 }}><Txt v="bodyStrong">{b.name}</Txt><Txt v="caption" tone="muted" numberOfLines={1}>{[b.category, b.handle && `@${b.handle}`].filter(Boolean).join(' · ')}</Txt></View>
          <Icon name="chevron-forward" size={18} tone="faint" />
        </Pressy>
      ))}
      {!busy && q.trim().length >= 2 && rows.length === 0 && !error && <EmptyState icon="storefront" title="Sin resultados" body="Prueba con otro nombre o el identificador exacto del negocio." />}
    </View>
  );
}
