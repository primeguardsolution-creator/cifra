import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import { Chat, countMissedCalls, listChats, markDelivered } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useToast } from '../ui';
import { useAuth } from './AuthProvider';
import { useSpace } from './SpaceProvider';
import { tr } from '../i18n';

type ChatsState = {
  chats: Chat[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  unread: { personal: number; business: number };
  patch: (id: string, change: Partial<Chat>) => void;
  missedCalls: number;
  markCallsSeen: () => void;
};
const Ctx = createContext<ChatsState | null>(null);

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { space, active } = useSpace();
  const businessId = active?.business.id ?? null;
  const [personal, setPersonal] = useState<Chat[]>([]);
  const [business, setBusiness] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missedCalls, setMissedCalls] = useState(0);
  const seq = useRef(0);
  const toast = useToast();
  const path = usePathname();
  const pathRef = useRef(path); pathRef.current = path;
  const listsRef = useRef<Chat[]>([]);
  const seenKey = `cifra.callsSeen.${user?.id ?? ''}`;

  const refresh = useCallback(async () => {
    if (!user) return;
    const mine = ++seq.current;
    try {
      const [p, b] = await Promise.all([listChats(null), businessId ? listChats(businessId) : Promise.resolve([] as Chat[])]);
      if (mine !== seq.current) return;
      setPersonal(p); setBusiness(b); setError(null); listsRef.current = [...p, ...b];
      markDelivered().catch(() => {}); // the sender sees two ticks: these messages reached this device
      try {
        let since = await AsyncStorage.getItem(seenKey);
        if (!since) { since = new Date().toISOString(); await AsyncStorage.setItem(seenKey, since); }
        if (mine === seq.current) setMissedCalls(await countMissedCalls(user.id, since));
      } catch { /* the badge is optional */ }
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : 'No se pudieron cargar los chats.');
    } finally { if (mine === seq.current) setLoading(false); }
  }, [user, businessId, seenKey]);

  const markCallsSeen = useCallback(() => { setMissedCalls(0); AsyncStorage.setItem(seenKey, new Date().toISOString()).catch(() => {}); }, [seenKey]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  // Realtime: any message / read-state change in a conversation I can access refreshes the lists.
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(refresh, 350); };
    const channel = supabase.channel(`inbox:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        soon();
        const row = payload.new as { sender_id?: string; body?: string | null; is_internal?: boolean; conversation_id?: string; attachment_type?: string | null; is_automated?: boolean };
        if (payload.eventType === 'INSERT' && row.sender_id !== user.id && !row.is_internal) {
          notifyBrowser();
          // In-app popup when the message is for a chat that is not on screen (tap to open it).
          const conv = row.conversation_id; const chat = listsRef.current.find((x) => x.id === conv);
          const muted = chat?.muted_until && new Date(chat.muted_until) > new Date();
          if (conv && pathRef.current !== `/chat/${conv}` && !muted && !chat?.incognito) {
            const body = row.body?.trim() || tr(row.attachment_type?.startsWith('image') ? '📷 Foto' : row.attachment_type?.startsWith('video') ? '🎬 Vídeo' : row.attachment_type?.startsWith('audio') ? '🎤 Mensaje de voz' : '📎 Archivo');
            const title = chat ? (chat.peer_name || chat.title || tr('Mensaje nuevo')) : tr('Mensaje nuevo');
            toast.show(body, 'message', { title, duration: 5000, onPress: () => router.push({ pathname: '/chat/[id]', params: { id: conv } }) });
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members' }, soon)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversations' }, soon) // incognito rooms vanishing
      .subscribe((status) => { if (status === 'SUBSCRIBED') soon(); });
    const sub = AppState.addEventListener('change', (s) => s === 'active' && soon());
    return () => { clearTimeout(timer); sub.remove(); supabase.removeChannel(channel); };
  }, [user, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const chats = space === 'business' ? business : personal;
  const unread = useMemo(() => ({ personal: personal.reduce((n, c) => n + (c.muted_until && new Date(c.muted_until) > new Date() ? 0 : c.unread), 0), business: business.reduce((n, c) => n + c.unread, 0) }), [personal, business]);
  const patch = useCallback((id: string, change: Partial<Chat>) => {
    const apply = (list: Chat[]) => list.map((c) => (c.id === id ? { ...c, ...change } : c));
    setPersonal(apply); setBusiness(apply);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const n = unread.personal + unread.business;
    document.title = n > 0 ? `(${n}) CIFRA` : 'CIFRA';
  }, [unread]);

  const value = useMemo(() => ({ chats, loading, error, refresh, unread, patch, missedCalls, markCallsSeen }), [chats, loading, error, refresh, unread, patch, missedCalls, markCallsSeen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function notifyBrowser() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden) return;
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('CIFRA', { body: tr('Tienes un mensaje nuevo'), icon: '/icon-192.png', tag: 'cifra-message' });
  } catch { /* notifications are optional */ }
}

export function useChats(): ChatsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChats must be used inside ChatsProvider.');
  return v;
}
