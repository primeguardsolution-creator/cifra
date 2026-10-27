import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Billing, getBilling, goToStripe, isPaid } from '../../lib/billing';
import { friendly } from '../../lib/errors';
import { Button, Card, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Plan of the active business: subscribe through Stripe Checkout, or manage card / invoices / cancellation in the Stripe portal. */
export function BillingCard({ businessId }: { businessId: string }) {
  const toast = useToast();
  const [b, setB] = useState<Billing | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { getBilling(businessId).then(setB).catch(() => setB(null)).finally(() => setLoaded(true)); }, [businessId]);
  useEffect(() => { setLoaded(false); load(); }, [load]);
  // Back from Stripe (?billing=ok): the webhook may take a moment, so look again shortly.
  useEffect(() => {
    if (typeof window === 'undefined' || !/billing=ok/.test(window.location?.search ?? '')) return;
    const timers = [1500, 4000, 9000].map((ms) => setTimeout(load, ms));
    return () => timers.forEach(clearTimeout);
  }, [load]);

  const status = b?.status ?? 'none';
  const line = status === 'trialing' ? t('Prueba gratuita hasta el {date}', { date: day(b?.trial_end ?? null) })
    : status === 'active' ? (b?.cancel_at_period_end ? t('Activo hasta el {date} y no se renovará', { date: day(b?.current_period_end ?? null) }) : t('Activo · próxima renovación el {date}', { date: day(b?.current_period_end ?? null) }))
    : status === 'past_due' || status === 'unpaid' ? t('Hay un pago pendiente. Actualiza tu tarjeta para no perder el plan.')
    : status === 'canceled' ? t('Suscripción cancelada') : t('Aún no tienes plan');
  const go = async (action: 'checkout' | 'portal') => { setBusy(true); try { await goToStripe(action, businessId); } catch (e) { toast.show(friendly(e, 'No se pudo abrir el pago. Inténtalo de nuevo.'), 'error'); setBusy(false); } };

  if (!loaded) return null;
  return (
    <Card>
      <View style={{ padding: 16, gap: 10 }}>
        <Txt v="bodyStrong">{t('Plan Business')}</Txt>
        <Txt v="small" tone={status === 'past_due' || status === 'unpaid' ? 'danger' : 'muted'}>{line}</Txt>
        {isPaid(b) || status === 'canceled'
          ? <Button title={status === 'canceled' ? t('Reactivar plan') : t('Gestionar suscripción')} icon="card" variant="secondary" loading={busy} onPress={() => go(status === 'canceled' ? 'checkout' : 'portal')} />
          : <Button title={t('Activar plan Business')} icon="card" loading={busy} onPress={() => go('checkout')} />}
      </View>
    </Card>
  );
}
