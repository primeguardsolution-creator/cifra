import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Audience, listContacts } from '../../lib/api';
import { useChats } from '../../state/ChatsProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Button, Chip, Field, Icon, Pressy, Sheet, Txt } from '../../ui';
import { t } from '../../i18n';

const KEY = 'cifra.statusAudience';
export const ALL_AUDIENCE: Audience = { mode: 'all', ids: [] };

/** Remembers the last audience (like WhatsApp), so the next status starts with it. */
export async function loadAudience(): Promise<Audience> {
  try { const raw = await AsyncStorage.getItem(KEY); if (!raw) return ALL_AUDIENCE; const a = JSON.parse(raw) as Audience; return a && ['all', 'except', 'only'].includes(a.mode) && Array.isArray(a.ids) ? a : ALL_AUDIENCE; } catch { return ALL_AUDIENCE; }
}
export const saveAudience = (a: Audience) => AsyncStorage.setItem(KEY, JSON.stringify(a)).catch(() => {});
export const audienceLabel = (a: Audience) => (a.mode === 'all' ? t('Mis contactos y chats') : a.mode === 'except' ? t('Todos menos {n}', { n: a.ids.length }) : t('Solo {n} personas', { n: a.ids.length }));

type Person = { id: string; name: string; avatar: string | null };

/** "Who can see this status": everyone I chat with, everyone except some people, or only some people. */
export function AudienceSheet({ visible, value, onClose, onChange }: { visible: boolean; value: Audience; onClose: () => void; onChange: (a: Audience) => void }) {
  const { c } = useTheme();
  const { chats } = useChats();
  const [mode, setMode] = useState<Audience['mode']>(value.mode);
  const [ids, setIds] = useState<string[]>(value.ids);
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<Person[]>([]);
  useEffect(() => { if (visible) { setMode(value.mode); setIds(value.ids); setQ(''); } }, [visible, value]);
  useEffect(() => { if (visible) listContacts().then((rows) => setContacts(rows.filter((x) => x.contact_user_id).map((x) => ({ id: x.contact_user_id!, name: x.display_name, avatar: null })))).catch(() => {}); }, [visible]);
  // people I can reach: saved contacts plus the people I have a 1:1 chat with
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    contacts.forEach((p) => map.set(p.id, p));
    chats.forEach((ch) => { if (ch.kind === 'direct' && ch.peer_id && !ch.incognito) map.set(ch.peer_id, { id: ch.peer_id, name: ch.peer_name ?? ch.title ?? '…', avatar: ch.peer_avatar }); });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name)).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  }, [contacts, chats, q]);
  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const done = () => { onChange(mode === 'all' || ids.length === 0 ? ALL_AUDIENCE : { mode, ids }); onClose(); };

  return (
    <Sheet visible={visible} onClose={onClose} title="Quién puede verlo" scroll={false} maxHeight={640}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="Mis contactos y chats" active={mode === 'all'} onPress={() => setMode('all')} />
          <Chip label="Todos menos…" active={mode === 'except'} onPress={() => setMode('except')} />
          <Chip label="Solo con…" active={mode === 'only'} onPress={() => setMode('only')} />
        </View>
        {mode === 'all' ? <Txt v="small" tone="muted">Lo verá cualquiera con quien tengas un chat.</Txt> : (
          <>
            <Txt v="small" tone="muted">{mode === 'except' ? 'Elige a quién se lo ocultas.' : 'Elige quién puede verlo. Nadie más lo verá.'}</Txt>
            <Field value={q} onChangeText={setQ} placeholder="Buscar" icon="search" autoCapitalize="none" style={{ paddingVertical: 8 }} />
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {people.map((p) => {
                const on = ids.includes(p.id);
                return (
                  <Pressy key={p.id} onPress={() => toggle(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }}>
                    <Avatar name={p.name} seed={p.id} path={p.avatar} size={36} />
                    <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{p.name}</Txt>
                    <Icon name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? c.accent : c.textFaint} />
                  </Pressy>
                );
              })}
              {people.length === 0 && <Txt tone="muted" style={{ textAlign: 'center', padding: 16 }}>Aún no tienes contactos con cuenta.</Txt>}
            </ScrollView>
          </>
        )}
        <Button title="Listo" onPress={done} />
      </View>
    </Sheet>
  );
}
