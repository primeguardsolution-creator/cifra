import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createPoll } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { Button, Field, IconButton, Sheet, Toggle, Txt, useToast } from '../../ui';

/** New poll: a question and 2 to 6 options, single or multiple choice. */
export function PollSheet({ visible, conversationId, onClose, onCreated }: { visible: boolean; conversationId: string; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setQ(''); setOpts(['', '']); setMultiple(false); } }, [visible]);
  const clean = opts.map((o) => o.trim()).filter(Boolean);
  const send = async () => {
    setBusy(true);
    try { await createPoll(conversationId, q.trim(), clean, multiple); onCreated(); onClose(); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={() => !busy && onClose()} title="Nueva encuesta">
      <View style={{ gap: 12 }}>
        <Field label="Pregunta" value={q} onChangeText={setQ} maxLength={200} placeholder="¿Dónde cenamos?" />
        {opts.map((o, i) => (
          <Field key={i} label={`Opción ${i + 1}`} value={o} maxLength={100} onChangeText={(v) => setOpts((cur) => cur.map((x, j) => (j === i ? v : x)))}
            right={opts.length > 2 ? <IconButton icon="close-circle" label="Quitar opción" tone="muted" size={34} onPress={() => setOpts((cur) => cur.filter((_, j) => j !== i))} /> : undefined} />
        ))}
        {opts.length < 6 && <Button title="Añadir opción" icon="add" variant="ghost" onPress={() => setOpts((cur) => [...cur, ''])} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Txt style={{ flex: 1 }}>Permitir varias respuestas</Txt><Toggle value={multiple} onChange={setMultiple} label="Permitir varias respuestas" /></View>
        <Button title="Enviar encuesta" icon="send" size="lg" loading={busy} disabled={!q.trim() || clean.length < 2} onPress={send} />
      </View>
    </Sheet>
  );
}
