import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { hm, listAppointments, myAppointments } from '../../lib/biz';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { useToast } from '../../ui';
import { t } from '../../i18n';

const LEAD_MS = 5 * 60_000;

/**
 * In-app side of the "5 minutes before" reminder: while CIFRA is open it looks at the next half hour of your agenda (as a
 * participant and, in Business, as the team) and shows a banner when an appointment is 5 minutes away. When the app is closed the
 * server sends the same reminder as a push notification (see migration 13 / netlify/functions/push.mts).
 */
export function AppointmentReminders() {
  const { user } = useAuth();
  const { active } = useSpace();
  const toast = useToast();
  const shown = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const businessId = active?.business.id ?? null;

  useEffect(() => {
    if (!user || Platform.OS !== 'web') return;
    let live = true;
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    const arm = (id: string, title: string, startsAt: string, go: string) => {
      const start = new Date(startsAt).getTime();
      const wait = start - LEAD_MS - Date.now();
      if (shown.current.has(id) || start <= Date.now() || wait > 35 * 60_000) return;
      const fire = () => {
        if (shown.current.has(id)) return; shown.current.add(id);
        toast.show(t('Dentro de 5 minutos · {time}', { time: hm(startsAt) }), 'info', { title: `⏰ ${title}`, duration: 9000, onPress: () => router.push(go as never) });
      };
      timers.current.push(setTimeout(fire, Math.max(0, wait)));
    };
    const load = async () => {
      try {
        const now = new Date(); const soon = new Date(now.getTime() + 35 * 60_000);
        const mine = await myAppointments();
        if (!live) return; clear();
        for (const a of mine) if (['scheduled', 'confirmed'].includes(a.status)) arm(a.id, a.title, a.starts_at, '/my-appointments');
        if (businessId) {
          const team = await listAppointments(businessId, now, soon);
          if (!live) return;
          for (const a of team) if (['scheduled', 'confirmed'].includes(a.status) && (!a.assigned_to || a.assigned_to === user.id)) arm(a.id, a.title, a.starts_at, '/agenda');
        }
      } catch { /* reminders are best-effort */ }
    };
    load();
    const every = setInterval(load, 4 * 60_000);
    const vis = () => { if (typeof document !== 'undefined' && !document.hidden) load(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', vis);
    return () => { live = false; clear(); clearInterval(every); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', vis); };
  }, [user, businessId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
