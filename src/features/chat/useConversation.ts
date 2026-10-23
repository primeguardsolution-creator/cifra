import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  Chat, Message, PAGE, PersonCard, Reaction, deleteMessage, editMessage, fetchMemberReads, fetchMessages, fetchReactions, getChat, getProfiles, markRead, sendMessage, setReaction,
} from '../../lib/api';
import { friendly } from '../../lib/errors';
import { uuid } from '../../lib/format';
import { Picked, uploadMedia } from '../../lib/media';
import { supabase } from '../../lib/supabase';

type Typing = Record<string, number>;
const byNewest = (a: Message, b: Message) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : -1);

export function useConversation(id: string, me: string) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reads, setReads] = useState<Record<string, string | null>>({});
  const [people, setPeople] = useState<Record<string, PersonCard>>({});
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<Typing>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const known = useRef(new Set<string>());

  const resolvePeople = useCallback(async (ids: string[]) => {
    const missing = ids.filter((x) => x && !known.current.has(x));
    if (!missing.length) return;
    missing.forEach((x) => known.current.add(x));
    try { const rows = await getProfiles(missing); setPeople((p) => ({ ...p, ...Object.fromEntries(rows.map((r) => [r.id, r])) })); } catch { missing.forEach((x) => known.current.delete(x)); }
  }, []);

  const merge = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m, pending: false, failed: false });
      return [...map.values()].sort(byNewest);
    });
    resolvePeople(incoming.map((m) => m.sender_id));
  }, [resolvePeople]);

  const acknowledge = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ack = useCallback(() => {
    clearTimeout(acknowledge.current);
    acknowledge.current = setTimeout(() => { markRead(id).catch(() => {}); }, 400);
  }, [id]);

  const loadInitial = useCallback(async () => {
    try {
      const [meta, page, memberReads] = await Promise.all([getChat(id), fetchMessages(id), fetchMemberReads(id)]);
      if (!meta) { setError('Esta conversación no existe o no tienes acceso.'); return; }
      setChat(meta); merge(page); setHasMore(page.length === PAGE); setError(null);
      setReads(Object.fromEntries(memberReads.map((r) => [r.user_id, r.last_read_at])));
      fetchReactions(page.map((m) => m.id)).then((r) => setReactions((prev) => [...prev.filter((x) => !r.some((y) => y.message_id === x.message_id && y.user_id === x.user_id)), ...r])).catch(() => {});
      if (meta.peer_id) resolvePeople([meta.peer_id]);
      ack();
    } catch (e) { setError(friendly(e, 'No se pudo cargar la conversación.')); } finally { setLoading(false); }
  }, [id, merge, ack, resolvePeople]);

  useEffect(() => {
    setLoading(true); setMessages([]); setReactions([]); setChat(null); setError(null); known.current.clear();
    loadInitial();
    let first = true;
    const channel = supabase.channel(`chat:${id}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => {
        const m = p.new as Message; merge([m]);
        setTyping((t) => { const next = { ...t }; delete next[m.sender_id]; return next; });
        if (m.sender_id !== me) { const visible = Platform.OS !== 'web' || (typeof document !== 'undefined' && !document.hidden); if (visible) ack(); }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => merge([p.new as Message]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (p) => {
        const row = (p.eventType === 'DELETE' ? p.old : p.new) as Reaction;
        if (!row?.message_id) return;
        setReactions((prev) => {
          const rest = prev.filter((x) => !(x.message_id === row.message_id && x.user_id === row.user_id));
          return p.eventType === 'DELETE' ? rest : [...rest, row];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${id}` }, (p) => {
        const r = p.new as { user_id: string; last_read_at: string | null };
        setReads((prev) => ({ ...prev, [r.user_id]: r.last_read_at }));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const who = (payload as { user_id?: string }).user_id;
        if (who && who !== me) setTyping((t) => ({ ...t, [who]: Date.now() }));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { if (!first) loadInitial(); first = false; } // heal any gap after a reconnect
      });
    channelRef.current = channel;
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { loadInitial(); } });
    const vis = () => { if (typeof document !== 'undefined' && !document.hidden) loadInitial(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', vis);
    return () => {
      clearTimeout(acknowledge.current); sub.remove(); supabase.removeChannel(channel); channelRef.current = null;
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', vis);
    };
  }, [id, me, loadInitial, merge, ack]);

  // typing indicators expire after 4 s
  useEffect(() => {
    if (!Object.keys(typing).length) return;
    const t = setTimeout(() => setTyping((cur) => Object.fromEntries(Object.entries(cur).filter(([, at]) => Date.now() - at < 4000))), 1000);
    return () => clearTimeout(t);
  }, [typing]);

  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || !messages.length) return;
    setLoadingMore(true);
    try {
      const page = await fetchMessages(id, messages[messages.length - 1].created_at);
      merge(page); setHasMore(page.length === PAGE);
      fetchReactions(page.map((m) => m.id)).then((r) => setReactions((prev) => [...prev, ...r.filter((x) => !prev.some((y) => y.message_id === x.message_id && y.user_id === x.user_id))])).catch(() => {});
    } catch { /* keep hasMore so the person can retry by scrolling */ } finally { setLoadingMore(false); }
  }, [id, hasMore, loadingMore, messages, merge]);

  const deliver = useCallback(async (m: Message, file?: Picked) => {
    try {
      let attachment: Partial<Message> = {};
      if (file) {
        const path = await uploadMedia('chat-media', id, file);
        attachment = { attachment_path: path, attachment_type: file.type, attachment_name: file.name, attachment_size: file.size ?? null, attachment_duration_ms: file.durationMs ?? null };
      }
      const saved = await sendMessage({ id: m.id, conversation_id: id, sender_id: me, body: m.body, reply_to_id: m.reply_to_id, is_internal: m.is_internal, ...attachment });
      merge([saved]);
    } catch (e) {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, pending: false, failed: true } : x)));
      throw new Error(friendly(e, 'No se pudo enviar el mensaje.'));
    }
  }, [id, me, merge]);

  const pendingFiles = useRef(new Map<string, Picked>());

  const send = useCallback(async (opts: { body?: string; replyTo?: string | null; internal?: boolean; file?: Picked | null }) => {
    const body = opts.body?.trim() || null;
    if (!body && !opts.file) return;
    const m: Message = {
      id: uuid(), conversation_id: id, sender_id: me, body, attachment_path: null, attachment_type: opts.file?.type ?? null, attachment_name: opts.file?.name ?? null, attachment_size: opts.file?.size ?? null, attachment_duration_ms: opts.file?.durationMs ?? null,
      reply_to_id: opts.replyTo ?? null, edited_at: null, deleted_at: null, created_at: new Date().toISOString(), is_internal: !!opts.internal, is_automated: false, pending: true, localUri: opts.file?.uri,
    };
    if (opts.file) pendingFiles.current.set(m.id, opts.file);
    setMessages((prev) => [m, ...prev].sort(byNewest));
    await deliver(m, opts.file ?? undefined);
    pendingFiles.current.delete(m.id);
  }, [id, me, deliver]);

  const retry = useCallback(async (m: Message) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, pending: true, failed: false } : x)));
    await deliver(m, pendingFiles.current.get(m.id));
  }, [deliver]);

  const discard = useCallback((m: Message) => setMessages((prev) => prev.filter((x) => x.id !== m.id)), []);

  const edit = useCallback(async (mid: string, body: string) => {
    setMessages((prev) => prev.map((x) => (x.id === mid ? { ...x, body, edited_at: new Date().toISOString() } : x)));
    try { await editMessage(mid, body); } catch (e) { loadInitial(); throw e; }
  }, [loadInitial]);

  const remove = useCallback(async (mid: string) => {
    const before = messages;
    setMessages((prev) => prev.map((x) => (x.id === mid ? { ...x, deleted_at: new Date().toISOString(), body: null, attachment_path: null } : x)));
    try { await deleteMessage(mid); } catch (e) { setMessages(before); throw e; }
  }, [messages]);

  const react = useCallback(async (mid: string, emoji: string | null) => {
    setReactions((prev) => { const rest = prev.filter((x) => !(x.message_id === mid && x.user_id === me)); return emoji ? [...rest, { message_id: mid, user_id: me, emoji }] : rest; });
    try { await setReaction(mid, me, emoji); } catch (e) { loadInitial(); throw e; }
  }, [me, loadInitial]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user_id: me } });
  }, [me]);

  const othersReadAt = useMemo(() => {
    const times = Object.entries(reads).filter(([u, t]) => u !== me && t).map(([, t]) => t as string);
    return times.length ? times.sort().pop()! : null;
  }, [reads, me]);

  const typingNow = Object.entries(typing).filter(([, at]) => Date.now() - at < 4000).map(([u]) => u);

  return { chat, setChat, messages, reactions, people, loading, error, hasMore, loadingMore, loadOlder, send, retry, discard, edit, remove, react, notifyTyping, othersReadAt, typingNow, reload: loadInitial };
}
