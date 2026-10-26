import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { friendly } from '../../lib/errors';
import { relative } from '../../lib/format';
import { ReportRow, adminListReports, adminReviewReport, adminSetSuspended, isPlatformAdmin } from '../../lib/moderation';
import { formatPhone } from '../../lib/phone';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Chip, EmptyState, IconButton, Sheet, Txt, useToast } from '../../ui';
import { router } from 'expo-router';
import { t } from '../../i18n';

type Tab = ReportRow['status'];
const TABS: { key: Tab; label: string }[] = [{ key: 'open', label: 'Pendientes' }, { key: 'reviewed', label: 'En revisión' }, { key: 'actioned', label: 'Con acción' }, { key: 'dismissed', label: 'Descartados' }];

/** Reports of unknown contacts and businesses, for the people who run CIFRA (platform admins). */
export default function Moderation() {
  const { c, r } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sel, setSel] = useState<ReportRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { isPlatformAdmin().then(setAdmin).catch(() => setAdmin(false)); }, []);
  const load = useCallback(async () => { try { setRows(await adminListReports(tab)); } catch (e) { toast.show(friendly(e), 'error'); setRows([]); } }, [tab, toast]);
  useEffect(() => { if (admin) { setRows(null); load(); } }, [admin, load]);

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.show(ok, 'success'); setSel(null); await load(); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };

  if (admin === false) return <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}><EmptyState icon="lock-closed" title="Solo para administradores" body="Esta pantalla es para quien gestiona CIFRA." action="Volver" onAction={() => router.back()} /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
        <Txt v="h1" style={{ flex: 1 }}>Moderación</Txt>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
        {TABS.map((x) => <Chip key={x.key} label={x.label} active={tab === x.key} onPress={() => setTab(x.key)} />)}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, alignItems: 'center' }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={{ width: '100%', maxWidth: 640, gap: 10 }}>
          {rows === null || admin === null ? <Txt tone="muted">Cargando…</Txt> : rows.length === 0 ? <EmptyState icon="shield-checkmark" title="Nada por revisar" body="Cuando alguien reporte un contacto o un negocio, aparecerá aquí." /> : rows.map((x) => (
            <View key={x.id} style={{ gap: 6, padding: 14, borderRadius: r(14), borderWidth: 1, borderColor: x.reports_against > 1 ? c.danger : c.border, backgroundColor: c.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{x.reported_name ?? x.business_name ?? 'Cuenta eliminada'}{x.reported_username ? ` · @${x.reported_username}` : ''}</Txt>
                {x.suspended && <Txt v="caption" tone="danger">SUSPENDIDA</Txt>}
              </View>
              <Txt>{x.reason}</Txt>
              <Txt v="caption" tone="muted">{t('{n} reportes contra esta cuenta', { n: x.reports_against })} · {relative(x.created_at)}{x.reporter_name ? t(' · lo reportó {name}', { name: x.reporter_name }) : ''}</Txt>
              {x.note ? <Txt v="caption" tone="muted">{x.note}</Txt> : null}
              <Button title="Revisar" variant="secondary" size="sm" onPress={() => setSel(x)} />
            </View>
          ))}
        </View>
      </ScrollView>

      <Sheet visible={!!sel} onClose={() => !busy && setSel(null)} title="Reporte">
        {sel && (
          <View style={{ gap: 12 }}>
            <Txt v="bodyStrong">{sel.reported_name ?? sel.business_name ?? 'Cuenta eliminada'}</Txt>
            {sel.reported_phone ? <Txt tone="muted">{formatPhone(sel.reported_phone)}</Txt> : null}
            <Txt>{sel.reason}</Txt>
            <Txt v="caption" tone="muted">{t('{n} reportes contra esta cuenta', { n: sel.reports_against })}</Txt>
            <Button title="Marcar en revisión" icon="eye" variant="secondary" loading={busy} onPress={() => act(() => adminReviewReport(sel.id, 'reviewed'), 'Marcado en revisión')} />
            <Button title="Descartar reporte" icon="close-circle" variant="secondary" loading={busy} onPress={() => act(() => adminReviewReport(sel.id, 'dismissed'), 'Reporte descartado')} />
            {sel.reported_id && !sel.suspended && <Button title="Suspender cuenta" icon="ban" variant="danger" loading={busy} onPress={() => act(() => adminSetSuspended(sel.reported_id!, true, sel.reason), 'Cuenta suspendida')} />}
            {sel.reported_id && sel.suspended && <Button title="Reactivar cuenta" icon="refresh" loading={busy} onPress={() => act(() => adminSetSuspended(sel.reported_id!, false), 'Cuenta reactivada')} />}
            <Button title="Cerrar" variant="ghost" disabled={busy} onPress={() => setSel(null)} />
          </View>
        )}
      </Sheet>
    </View>
  );
}
