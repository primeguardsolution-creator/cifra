import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { listStatuses } from '../lib/api';
import { listRequestedAppointments, myAppointments } from '../lib/biz';
import { useAuth } from './AuthProvider';
import { useSpace } from './SpaceProvider';

/** Bubbles for what is waiting for you besides unread chats: new statuses, appointment invitations, and (Business) appointment requests. */
type Attention = { statuses: number; invites: number; requests: number; refresh: () => void };
const Ctx = createContext<Attention>({ statuses: 0, invites: 0, requests: 0, refresh: () => {} });
const listeners = new Set<() => void>();
/** Screens that change what is pending (opening a status, answering an invitation) call this so the bubbles update at once. */
export const pingAttention = () => listeners.forEach((f) => f());

export function AttentionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { active } = useSpace();
  const businessId = active?.business.id ?? null;
  const [n, setN] = useState({ statuses: 0, invites: 0, requests: 0 });

  const load = useCallback(async () => {
    if (!user) return;
    const [statuses, invites, requests] = await Promise.all([
      (async () => {
        const [rows, raw] = await Promise.all([listStatuses(), AsyncStorage.getItem(`cifra.statusSeen.${user.id}`)]);
        const seen = (raw ? JSON.parse(raw) : {}) as Record<string, string>;
        const latest = new Map<string, string>();
        rows.forEach((r) => { if (r.user_id !== user.id && (!latest.get(r.user_id) || latest.get(r.user_id)! < r.created_at)) latest.set(r.user_id, r.created_at); });
        return [...latest].filter(([id, at]) => !(seen[id] && seen[id] >= at)).length;
      })().catch(() => 0),
      myAppointments().then((l) => l.filter((a) => a.status === 'scheduled' && new Date(a.ends_at) > new Date()).length).catch(() => 0),
      businessId ? listRequestedAppointments(businessId).then((l) => l.length).catch(() => 0) : Promise.resolve(0),
    ]);
    setN((cur) => (cur.statuses === statuses && cur.invites === invites && cur.requests === requests ? cur : { statuses, invites, requests }));
  }, [user, businessId]);

  useEffect(() => {
    if (!user) { setN({ statuses: 0, invites: 0, requests: 0 }); return; }
    load();
    listeners.add(load);
    const every = setInterval(load, 90_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => { listeners.delete(load); clearInterval(every); sub.remove(); };
  }, [user, load]);

  const value = useMemo(() => ({ ...n, refresh: load }), [n, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAttention = () => useContext(Ctx);
