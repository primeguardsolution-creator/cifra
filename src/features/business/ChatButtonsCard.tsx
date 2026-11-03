import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ACTION_META, ActionType, ChatAction, actionsAdmin, saveActions, validActionUrl } from '../../lib/actions';
import { friendly } from '../../lib/errors';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Divider, Field, Icon, IconButton, SheetRow, Toggle, Txt, useToast } from '../../ui';
import { tr } from '../../i18n';

const MAX = 8;

/** Business -> Profile: which buttons customers see in your chats, in which order, with what label and (optionally) which URL. */
export function ChatButtonsCard({ businessId }: { businessId: string }) {
  const { c } = useTheme();
  const toast = useToast();
  const [list, setList] = useState<ChatAction[] | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { actionsAdmin(businessId).then((l) => { setList(l); setSaved(JSON.stringify(l)); }).catch(() => setList([])); }, [businessId]);
  if (!list) return null;

  const set = (i: number, patch: Partial<ChatAction>) => setList((cur) => cur?.map((a, j) => (j === i ? { ...a, ...patch } : a)) ?? cur);
  const move = (i: number, d: -1 | 1) => setList((cur) => { if (!cur) return cur; const j = i + d; if (j < 0 || j >= cur.length) return cur; const n = [...cur]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const badUrl = list.some((a) => !validActionUrl(a.url ?? '') || ((a.type === 'link' || a.type === 'payment') && !(a.url ?? '').trim()));
  const dirty = JSON.stringify(list) !== saved;
  const save = async () => {
    setBusy(true);
    try { await saveActions(businessId, list); setSaved(JSON.stringify(list)); toast.show('Botones guardados', 'success'); } catch (e) { toast.show(friendly(e, 'No se pudo guardar.'), 'error'); } finally { setBusy(false); }
  };

  return (
    <Card>
      <View style={{ padding: 16, gap: 6 }}>
        <Txt v="bodyStrong">Botones del chat</Txt>
        <Txt v="small" tone="muted">Elige qué botones ven tus clientes sobre el campo de mensaje y en qué orden. Si pones una URL, el botón abre ese enlace (https, tel: o mailto:) en lugar de la acción de CIFRA.</Txt>
      </View>
      {list.map((a, i) => (
        <View key={`${a.type}-${i}`}><Divider />
          <View style={{ padding: 14, gap: 10, opacity: a.enabled === false ? 0.6 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name={ACTION_META[a.type].icon} size={20} color={c.highlight} />
              <View style={{ flex: 1 }}><Txt v="bodyStrong">{tr(ACTION_META[a.type].name)}</Txt><Txt v="caption" tone="muted">{tr(ACTION_META[a.type].hint)}</Txt></View>
              <IconButton icon="chevron-up" label="Subir" size={32} onPress={() => move(i, -1)} />
              <IconButton icon="chevron-down" label="Bajar" size={32} onPress={() => move(i, 1)} />
              <Toggle value={a.enabled !== false} label={tr('Mostrar')} onChange={(v) => set(i, { enabled: v })} />
            </View>
            {/* Default labels are stored in Spanish and shown in the app language; once you type your own text it is kept as typed. */}
            <Field label="Texto del botón" value={a.label === ACTION_META[a.type].name ? tr(a.label) : a.label} onChangeText={(v) => set(i, { label: v === tr(ACTION_META[a.type].name) ? ACTION_META[a.type].name : v })} maxLength={40} />
            <Field label={a.type === 'link' || a.type === 'payment' ? 'URL (obligatoria)' : 'URL (opcional)'} value={a.url ?? ''} onChangeText={(v) => set(i, { url: v })} placeholder={a.type === 'call' ? 'tel:+34600123456' : a.type === 'payment' ? 'https://pay.tuempresa.com/…' : 'https://…'} autoCapitalize="none" keyboardType="url"
              error={!validActionUrl(a.url ?? '') ? 'Usa https://, tel: o mailto:' : undefined} />
            {(a.type === 'link' || a.type === 'payment') && <Button title="Quitar este botón" variant="soft" size="sm" icon="trash" onPress={() => setList((cur) => cur?.filter((_, j) => j !== i) ?? cur)} />}
          </View>
        </View>
      ))}
      {list.length < MAX && !list.some((a) => a.type === 'payment') && <><Divider /><SheetRow icon="card" label="Añadir botón de pago" tone="accent" onPress={() => setList((cur) => [...(cur ?? []), { type: 'payment' as ActionType, label: ACTION_META.payment.name, url: '', enabled: true }])} /></>}
      {list.length < MAX && <><Divider /><SheetRow icon="add-circle" label="Añadir botón de enlace" tone="accent" onPress={() => setList((cur) => [...(cur ?? []), { type: 'link' as ActionType, label: '', url: '', enabled: true }])} /></>}
      <Divider />
      <View style={{ padding: 14 }}><Button title="Guardar botones" loading={busy} disabled={!dirty || badUrl} onPress={save} /></View>
    </Card>
  );
}
