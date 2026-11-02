import { createElement, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { ChatEvent } from '../../lib/chatCards';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Chip, Field, Sheet, Txt } from '../../ui';
import { loc, t, tr } from '../../i18n';

const pad = (n: number) => String(n).padStart(2, '0');
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const at = (days: number, h: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, 0, 0, 0); return d; };

/** Create an event to send in a chat: title, when, how long, where. */
export function EventSheet({ visible, onClose, onSend }: { visible: boolean; onClose: () => void; onSend: (e: ChatEvent) => Promise<void> | void }) {
  const { c } = useTheme();
  const [title, setTitle] = useState(''); const [start, setStart] = useState<Date | null>(null); const [minutes, setMinutes] = useState(60);
  const [place, setPlace] = useState(''); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setTitle(''); setStart(null); setMinutes(60); setPlace(''); setNotes(''); } }, [visible]);
  const presets = [{ l: 'Hoy 20:00', d: at(0, 20) }, { l: 'Mañana 10:00', d: at(1, 10) }, { l: 'Mañana 18:00', d: at(1, 18) }, { l: 'En una semana', d: at(7, 18) }].filter((p) => p.d.getTime() > Date.now());
  const valid = title.trim().length > 0 && !!start && start.getTime() > Date.now() - 60000;
  const send = async () => { if (!start) return; setBusy(true); try { await onSend({ title, start, minutes, place, notes }); onClose(); } finally { setBusy(false); } };
  return (
    <Sheet visible={visible} onClose={onClose} title="Nuevo evento">
      <View style={{ gap: 12 }}>
        <Field label="Título" value={title} onChangeText={setTitle} placeholder="Cena de equipo" maxLength={80} />
        <Txt v="mono" tone="faint">CUÁNDO</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {presets.map((p) => <Chip key={p.l} label={p.l} active={!!start && start.getTime() === p.d.getTime()} onPress={() => setStart(p.d)} />)}
        </View>
        {Platform.OS === 'web' && createElement('input', { type: 'datetime-local', value: start ? localInput(start) : '', min: localInput(new Date()), 'aria-label': tr('Fecha y hora'), onChange: (e: { target: { value: string } }) => { const d = e.target.value ? new Date(e.target.value) : null; setStart(d && !Number.isNaN(d.getTime()) ? d : null); }, style: { height: 46, borderRadius: 12, border: `1.5px solid ${c.border}`, background: c.surface, color: c.text, padding: '0 12px', fontSize: 16, fontFamily: 'inherit' } })}
        {start && <Txt v="small" tone="muted">{start.toLocaleString(loc(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</Txt>}
        <Txt v="mono" tone="faint">DURACIÓN</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[30, 60, 90, 120, 240].map((m) => <Chip key={m} label={m < 60 ? t('{n} min', { n: m }) : m % 60 ? t('{h} h {m} min', { h: Math.floor(m / 60), m: m % 60 }) : t('{h} h', { h: m / 60 })} active={minutes === m} onPress={() => setMinutes(m)} />)}
        </View>
        <Field label="Lugar (opcional)" value={place} onChangeText={setPlace} placeholder="Calle Mayor 1, o un enlace de videollamada" maxLength={100} />
        <Field label="Notas (opcional)" value={notes} onChangeText={setNotes} multiline maxLength={300} />
        <Button title="Enviar evento" icon="send" disabled={!valid} loading={busy} onPress={send} />
      </View>
    </Sheet>
  );
}
