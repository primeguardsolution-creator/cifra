import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { UserHit, findUserByPhone, searchUsers } from '../lib/api';
import { countries, toE164 } from '../lib/phone';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar, Field, Icon, Pressy, Txt } from '../ui';

export type PersonHitRow = { id: string; name: string; sub: string; avatar: string | null };

/**
 * Finds CIFRA accounts by @username (prefix search) or by phone number and lists them with their photo. `onPick` receives the
 * chosen person; `exclude` hides accounts that are already added.
 */
export function PersonSearch({ onPick, exclude = [], placeholder = '@usuario o número de teléfono', autoFocus }: { onPick: (p: PersonHitRow) => void; exclude?: string[]; placeholder?: string; autoFocus?: boolean }) {
  const { c, r } = useTheme();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PersonHitRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    const s = q.trim().replace(/^@/, '');
    if (s.length < 2) { setHits([]); setBusy(false); setAsked(false); return; }
    setBusy(true);
    const tm = setTimeout(async () => {
      try {
        let out: PersonHitRow[] = [];
        if (/^[+\d][\d\s().-]{5,}$/.test(s)) {
          const p = toE164(countries[0], s.startsWith('+') ? s : q.trim());
          if (p.ok) out = (await findUserByPhone(p.e164)).filter((x) => !x.is_self).map((x) => ({ id: x.id, name: x.display_name, sub: p.e164, avatar: x.avatar_path }));
        } else if (/^[A-Za-z0-9_]{2,32}$/.test(s)) {
          out = (await searchUsers(s)).filter((x: UserHit) => !x.is_self).map((x) => ({ id: x.id, name: x.display_name, sub: `@${x.username}`, avatar: x.avatar_path }));
        }
        if (mine === seq.current) { setHits(out); setAsked(true); }
      } catch { if (mine === seq.current) { setHits([]); setAsked(true); } } finally { if (mine === seq.current) setBusy(false); }
    }, 300);
    return () => clearTimeout(tm);
  }, [q]);
  const shown = hits.filter((h) => !exclude.includes(h.id));
  return (
    <View style={{ gap: 8 }}>
      <Field value={q} onChangeText={setQ} placeholder={placeholder} icon="at" autoCapitalize="none" autoCorrect={false} autoFocus={autoFocus} right={busy ? <ActivityIndicator color={c.accent} /> : undefined} />
      {shown.map((h) => (
        <Pressy key={h.id} onPress={() => onPick(h)} accessibilityRole="button" accessibilityLabel={h.name} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r(14), borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <Avatar name={h.name} seed={h.id} path={h.avatar} size={44} />
          <View style={{ flex: 1 }}><Txt v="bodyStrong" numberOfLines={1}>{h.name}</Txt><Txt v="caption" tone="muted">{h.sub}</Txt></View>
          <Icon name="add-circle" size={22} tone="accent" />
        </Pressy>
      ))}
      {asked && !busy && q.trim().length >= 2 && shown.length === 0 && <Txt v="caption" tone="faint">{hits.length ? 'Ya está en tus clientes.' : 'Nadie con ese @usuario o número en CIFRA. Puedes añadirlo a mano.'}</Txt>}
    </View>
  );
}
