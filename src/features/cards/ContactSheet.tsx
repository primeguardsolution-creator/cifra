import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { listContacts } from '../../lib/api';
import { SharedContact } from '../../lib/chatCards';
import { useChats } from '../../state/ChatsProvider';
import { Avatar, Field, Pressy, Sheet, Txt } from '../../ui';

/** Pick one of your contacts to send as a card. Only people with a CIFRA account can be shared, and only their profile link: never their phone number. */
export function ContactSheet({ visible, onClose, onSend, exclude }: { visible: boolean; onClose: () => void; onSend: (c: SharedContact) => Promise<void> | void; exclude?: string[] }) {
  const { chats } = useChats();
  const [rows, setRows] = useState<{ id: string; name: string; avatar: string | null }[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (!visible) return; setQ(''); listContacts().then((cs) => setRows(cs.filter((x) => x.contact_user_id).map((x) => ({ id: x.contact_user_id!, name: x.display_name, avatar: null })))).catch(() => setRows([])); }, [visible]);
  const people = useMemo(() => {
    const map = new Map(rows.map((r) => [r.id, r]));
    chats.forEach((ch) => { if (ch.kind === 'direct' && ch.peer_id && !ch.incognito && !map.has(ch.peer_id)) map.set(ch.peer_id, { id: ch.peer_id, name: ch.peer_name ?? ch.title ?? '…', avatar: ch.peer_avatar }); else if (ch.kind === 'direct' && ch.peer_id && map.has(ch.peer_id) && ch.peer_avatar) map.set(ch.peer_id, { ...map.get(ch.peer_id)!, avatar: ch.peer_avatar }); });
    return [...map.values()].filter((p) => !exclude?.includes(p.id) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, chats, q, exclude]);
  const pick = async (p: { id: string; name: string }) => { setBusy(p.id); try { await onSend({ id: p.id, name: p.name }); onClose(); } finally { setBusy(null); } };
  return (
    <Sheet visible={visible} onClose={onClose} title="Enviar contacto" scroll={false} maxHeight={620}>
      <View style={{ gap: 10 }}>
        <Txt v="small" tone="muted">Solo se comparte su perfil de CIFRA, nunca su número de teléfono.</Txt>
        <Field value={q} onChangeText={setQ} placeholder="Buscar" icon="search" autoCapitalize="none" style={{ paddingVertical: 8 }} />
        <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
          {people.map((p) => (
            <Pressy key={p.id} onPress={() => pick(p)} disabled={!!busy} accessibilityRole="button" scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, opacity: busy && busy !== p.id ? 0.5 : 1 }}>
              <Avatar name={p.name} seed={p.id} path={p.avatar} size={40} /><Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{p.name}</Txt>
            </Pressy>
          ))}
          {people.length === 0 && <Txt tone="muted" style={{ textAlign: 'center', padding: 16 }}>Aún no tienes contactos con cuenta.</Txt>}
        </ScrollView>
      </View>
    </Sheet>
  );
}
