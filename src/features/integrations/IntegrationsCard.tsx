import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { ApiKey, Delivery, WEBHOOK_EVENTS, Webhook, createApiKey, createWebhook, deleteWebhook, listApiKeys, listDeliveries, listWebhooks, revokeApiKey, testWebhook, updateWebhook } from '../../lib/integrations';
import { friendly } from '../../lib/errors';
import { relative } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Chip, Divider, Field, Icon, Pressy, Sheet, SheetRow, Toggle, Txt, useToast } from '../../ui';
import { t, tr } from '../../i18n';

const host = (u: string) => { try { return new URL(u).host; } catch { return u; } };

/** Business -> Integrations: outgoing webhooks (events to Make / Zapier / n8n / your server) and API keys for incoming automation. Managers only. */
export function IntegrationsCard({ businessId }: { businessId: string }) {
  const { c } = useTheme();
  const toast = useToast();
  const [hooks, setHooks] = useState<Webhook[] | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [editing, setEditing] = useState<Webhook | 'new' | null>(null);
  const [name, setName] = useState(''); const [url, setUrl] = useState(''); const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [log, setLog] = useState<{ hook: Webhook; rows: Delivery[] } | null>(null);
  const [keySheet, setKeySheet] = useState(false); const [keyName, setKeyName] = useState('');

  const load = useCallback(() => { listWebhooks(businessId).then(setHooks).catch(() => setHooks([])); listApiKeys(businessId).then(setKeys).catch(() => setKeys([])); }, [businessId]);
  useEffect(() => { load(); }, [load]);
  const copy = async (v: string) => { await Clipboard.setStringAsync(v); toast.show('Copiado', 'success'); };
  const open = (h: Webhook | 'new') => { setEditing(h); setName(h === 'new' ? '' : h.name); setUrl(h === 'new' ? '' : h.url); setEvents(h === 'new' ? ['message.received'] : h.events); };
  const valid = /^https:\/\/[^\s/]+\.[^\s/]+/.test(url.trim()) && name.trim().length > 0 && events.length > 0;

  const save = async () => {
    if (!editing) return; setBusy(true);
    try {
      if (editing === 'new') { const h = await createWebhook({ business_id: businessId, name: name.trim(), url: url.trim(), events }); setSecret({ title: t('Secreto de {name}', { name: h.name }), value: h.secret }); }
      else await updateWebhook(editing.id, { name: name.trim(), url: url.trim(), events });
      setEditing(null); load();
    } catch (e) { toast.show(friendly(e, 'No se pudo guardar.'), 'error'); } finally { setBusy(false); }
  };
  const test = async (h: Webhook) => {
    try {
      const r = await testWebhook(h.id);
      toast.show(r.ok > 0 ? t('Recibido por {host} (código {code})', { host: host(h.url), code: r.last?.code ?? 200 }) : t('No llegó: {why}', { why: r.last?.error ?? tr('sin respuesta') }), r.ok > 0 ? 'success' : 'error'); load();
    } catch (e) { toast.show(friendly(e, 'No se pudo probar.'), 'error'); }
  };
  const makeKey = async () => {
    setBusy(true);
    try { const k = await createApiKey(businessId, keyName.trim() || 'API'); setKeySheet(false); setKeyName(''); setSecret({ title: tr('Clave de API'), value: k }); load(); } catch (e) { toast.show(/too_many_keys/.test(String((e as Error).message)) ? 'Máximo 10 claves activas.' : friendly(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <Card>
        <View style={{ padding: 16, gap: 6 }}>
          <Txt v="bodyStrong">Webhooks</Txt>
          <Txt v="small" tone="muted">Avisamos a Make, Zapier, n8n o a tu servidor cuando ocurre algo: un cliente escribe, entra un cliente nuevo, cambia una cita. Cada aviso va firmado.</Txt>
        </View>
        {(hooks ?? []).map((h) => (
          <View key={h.id}><Divider />
            <View style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong" numberOfLines={1}>{h.name}</Txt>
                  <Txt v="caption" tone="muted" numberOfLines={1}>{host(h.url)} · {t('{n} eventos', { n: h.events.length })}</Txt>
                </View>
                <Toggle value={h.active} label={tr('Activo')} onChange={(v) => { setHooks((cur) => cur?.map((x) => (x.id === h.id ? { ...x, active: v } : x)) ?? cur); updateWebhook(h.id, { active: v }).catch(() => load()); }} />
              </View>
              {h.last_at && <Txt v="caption" style={{ color: h.last_status && h.last_status >= 200 && h.last_status < 300 ? c.success : c.danger }}>{h.last_status && h.last_status >= 200 && h.last_status < 300 ? t('Último aviso correcto · {when}', { when: relative(h.last_at) }) : t('Último aviso falló ({why}) · {when}', { why: h.last_error ?? h.last_status ?? '?', when: relative(h.last_at) })}</Txt>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button title="Probar" icon="paper-plane" size="sm" variant="soft" onPress={() => test(h)} />
                <Button title="Entregas" icon="list" size="sm" variant="soft" onPress={async () => setLog({ hook: h, rows: await listDeliveries(h.id).catch(() => []) })} />
                <Button title="Editar" icon="create" size="sm" variant="soft" onPress={() => open(h)} />
                <Button title="Secreto" icon="key" size="sm" variant="soft" onPress={() => setSecret({ title: t('Secreto de {name}', { name: h.name }), value: h.secret })} />
              </View>
            </View>
          </View>
        ))}
        <Divider /><SheetRow icon="add-circle" label="Añadir webhook" tone="accent" onPress={() => open('new')} />
      </Card>

      <Card>
        <View style={{ padding: 16, gap: 6 }}>
          <Txt v="bodyStrong">Claves de API</Txt>
          <Txt v="small" tone="muted">Para que otras herramientas creen clientes y tareas en CIFRA. Se muestran una sola vez. Guía y ejemplos en docs/integrations.md.</Txt>
        </View>
        {keys.map((k) => (
          <View key={k.id}><Divider />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
              <Icon name="key" size={18} color={c.highlight} />
              <View style={{ flex: 1 }}><Txt v="bodyStrong" numberOfLines={1}>{k.name}</Txt><Txt v="caption" tone="muted">{k.key_prefix}… · {k.last_used_at ? t('usada {when}', { when: relative(k.last_used_at) }) : tr('sin usar')}</Txt></View>
              <Pressy onPress={async () => { try { await revokeApiKey(k.id); load(); toast.show('Clave revocada', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } }} accessibilityRole="button" accessibilityLabel="Revocar clave" scale={0.92}><Txt v="smallStrong" style={{ color: c.danger }}>Revocar</Txt></Pressy>
            </View>
          </View>
        ))}
        <Divider /><SheetRow icon="add-circle" label="Crear clave de API" tone="accent" onPress={() => setKeySheet(true)} />
      </Card>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nuevo webhook' : 'Editar webhook'}>
        <View style={{ gap: 12 }}>
          <Field label="Nombre" value={name} onChangeText={setName} placeholder="Make · nuevos clientes" maxLength={60} />
          <Field label="URL (https)" value={url} onChangeText={setUrl} placeholder="https://hook.eu1.make.com/…" autoCapitalize="none" keyboardType="url" />
          <Txt v="mono" tone="faint">EVENTOS</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {WEBHOOK_EVENTS.map((e) => <Chip key={e.key} label={e.label} active={events.includes(e.key)} onPress={() => setEvents((cur) => (cur.includes(e.key) ? cur.filter((x) => x !== e.key) : [...cur, e.key]))} />)}
          </View>
          {editing && editing !== 'new' && <Button title="Eliminar webhook" variant="danger" icon="trash" onPress={async () => { const id = editing.id; setEditing(null); try { await deleteWebhook(id); load(); } catch (e) { toast.show(friendly(e), 'error'); } }} />}
          <Button title="Guardar" disabled={!valid} loading={busy} onPress={save} />
        </View>
      </Sheet>

      <Sheet visible={keySheet} onClose={() => setKeySheet(false)} title="Nueva clave de API">
        <View style={{ gap: 12 }}>
          <Field label="Nombre" value={keyName} onChangeText={setKeyName} placeholder="Make, Zapier, mi web…" maxLength={60} />
          <Button title="Crear clave" loading={busy} onPress={makeKey} />
        </View>
      </Sheet>

      <Sheet visible={!!secret} onClose={() => setSecret(null)} title={secret?.title}>
        {secret && (
          <View style={{ gap: 12 }}>
            <Txt v="small" tone="muted">Guárdalo en un lugar seguro. {secret.value.startsWith('cifra_') ? 'No volveremos a mostrarlo.' : 'Sirve para verificar la firma X-Cifra-Signature.'}</Txt>
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: c.sunken }}><Txt v="mono" selectable>{secret.value}</Txt></View>
            <Button title="Copiar" icon="copy" onPress={() => copy(secret.value)} />
          </View>
        )}
      </Sheet>

      <Sheet visible={!!log} onClose={() => setLog(null)} title={log ? t('Entregas de {name}', { name: log.hook.name }) : undefined}>
        {log && (log.rows.length === 0 ? <Txt tone="muted">Aún no hay entregas.</Txt> : log.rows.map((d) => (
          <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <Icon name={d.status === 'delivered' ? 'checkmark-circle' : d.status === 'failed' ? 'close-circle' : 'time'} size={20} color={d.status === 'delivered' ? c.success : d.status === 'failed' ? c.danger : c.textFaint} />
            <View style={{ flex: 1 }}><Txt v="smallStrong">{d.event}</Txt><Txt v="caption" tone="muted">{relative(d.created_at)} · {d.response_code ? `HTTP ${d.response_code}` : d.error ?? tr('pendiente')}{d.attempts > 1 ? ` · ${t('{n} intentos', { n: d.attempts })}` : ''}</Txt></View>
          </View>
        )))}
      </Sheet>
    </>
  );
}
