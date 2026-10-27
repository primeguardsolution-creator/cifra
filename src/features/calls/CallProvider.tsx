import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getProfiles, sendMessage, startDirectChat } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { uuid } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { callsSupported, getIceServers, startTone } from '../../lib/webrtc';
import { useAuth } from '../../state/AuthProvider';
import { useToast } from '../../ui';
import { CallOverlay } from './CallOverlay';
import { Kind, MeshRoom, PeerInfo, PeerView } from './mesh';
import { t } from '../../i18n';

export type CallKind = Kind;
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected';
export type CallPeer = PeerInfo;
export type CallView = {
  phase: CallPhase; kind: CallKind; direction: 'out' | 'in'; startedAt: number | null; muted: boolean; cameraOff: boolean; sharing: boolean; canShare: boolean;
  initiator: CallPeer; title: string | null; peers: PeerView[]; local: MediaStream | null; screen: MediaStream | null; reconnecting: boolean; notice: string | null; relay: boolean; group: boolean;
};
export type StartOptions = {
  /** Chat where the call is logged ("Videollamada · 4:12"). Defaults to the direct chat with the person. */
  conversationId?: string;
  /** For calls to a team: the first person who answers takes the call and the others stop ringing. */
  answerOnce?: boolean;
  title?: string;
};

type Ctx = { supported: boolean; busy: boolean; canShare: boolean; startCall: (peers: CallPeer | CallPeer[], kind: CallKind, opts?: StartOptions) => Promise<void> };
const CallCtx = createContext<Ctx>({ supported: false, busy: false, canShare: false, startCall: async () => {} });
export const useCall = () => useContext(CallCtx);

type Session = {
  callId: string; room: MeshRoom; kind: CallKind; direction: 'out' | 'in'; initiator: CallPeer; title: string | null; answered: boolean; answerOnce: boolean;
  conversationId?: string; stopTone: (() => void) | null; ringTimer?: ReturnType<typeof setTimeout>; logged: boolean;
};

const EVENTS = ['invite', 'accept', 'offer', 'answer', 'ice', 'decline', 'busy', 'cancel', 'end', 'join', 'leave', 'media'] as const;
const RING_TIMEOUT = 45_000;
const canShareScreen = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const supported = callsSupported();
  const [view, setView] = useState<CallView | null>(null);
  const session = useRef<Session | null>(null);
  const noticeRef = useRef<string | null>(null);

  const publish = useCallback(() => {
    const s = session.current;
    if (!s) { setView(null); return; }
    const r = s.room;
    const phase: CallPhase = r.startedAt ? 'connected' : s.direction === 'in' && !s.answered ? 'incoming' : r.joined && r.activeCount() > 0 ? 'connecting' : s.direction === 'out' ? 'outgoing' : 'connecting';
    setView({
      phase, kind: s.kind, direction: s.direction, startedAt: r.startedAt, muted: r.muted, cameraOff: r.camOff, sharing: r.sharing, canShare: canShareScreen(),
      initiator: s.initiator, title: s.title, peers: r.view(), local: r.local, screen: r.screen, reconnecting: r.reconnecting, notice: noticeRef.current, relay: r.relay, group: r.memberIds().length > 1,
    });
  }, []);

  const signal = useCallback(async (to: string, event: string, payload: Record<string, unknown>) => {
    const { error } = await supabase.rpc('send_call_signal', { p_to: to, p_event: event, p_payload: payload });
    if (error) throw new Error(friendly(error));
  }, []);

  const getMedia = useCallback(async (kind: CallKind) => {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: kind === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false });
    } catch (e) {
      throw new Error(/NotAllowed|denied|Permission/i.test(String(e)) ? (kind === 'video' ? 'Permite el micrófono y la cámara para llamar.' : 'Permite el micrófono para llamar.') : (kind === 'video' ? 'No se pudo acceder a la cámara o al micrófono.' : 'No se pudo acceder al micrófono.'));
    }
  }, []);

  const buildRoom = useCallback((callId: string, kind: CallKind, members: CallPeer[]) => {
    const me = user!.id;
    let room: MeshRoom;
    room = new MeshRoom({
      me, signal,
      createPC: async () => { const { servers, relay } = await getIceServers(); room.relay = relay; return new RTCPeerConnection({ iceServers: servers }); },
      getLocal: getMedia,
      getScreen: () => navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false }),
      onChange: () => { if (session.current?.room === room) { publish(); afterChangeRef.current(); } },
    }, callId, kind, members.filter((m) => m.id !== me));
    return room;
  }, [user, signal, getMedia, publish]);

  const logCall = useCallback(async (s: Session, outcome: 'done' | 'missed') => {
    if (!user || s.direction !== 'out' || s.logged) return;
    s.logged = true;
    const group = s.room.memberIds().length > 1;
    const icon = group ? '👥' : s.kind === 'video' ? '📹' : '📞';
    const label = group ? 'Llamada de grupo' : s.kind === 'video' ? 'Videollamada' : 'Llamada de voz';
    const secs = s.room.startedAt ? Math.round((Date.now() - s.room.startedAt) / 1000) : 0;
    const body = outcome === 'done' && s.room.startedAt ? `${icon} ${label} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${icon} ${label} sin respuesta`;
    try {
      const conv = s.conversationId ?? (await startDirectChat(s.room.memberIds()[0]));
      await sendMessage({ id: uuid(), conversation_id: conv, sender_id: user.id, body });
    } catch { /* the call log is best effort */ }
  }, [user]);

  const teardown = useCallback((notice?: string) => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    clearTimeout(s.ringTimer); s.stopTone?.();
    s.room.close();
    noticeRef.current = notice ?? null;
    if (notice) {
      setView((v) => (v ? { ...v, phase: 'idle', local: null, screen: null, peers: v.peers.map((p) => ({ ...p, stream: null })), notice } : v));
      setTimeout(() => { if (!session.current) { noticeRef.current = null; setView(null); } }, 1800);
    } else { noticeRef.current = null; setView(null); }
  }, []);

  /** After every change: is the call over for me? */
  const afterChange = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const r = s.room;
    if (r.startedAt) { s.stopTone?.(); s.stopTone = null; }
    if (!r.joined || r.closed) return;
    if (r.startedAt && r.isAlone()) { logCall(s, 'done'); teardown('Llamada finalizada'); return; }
    if (!r.startedAt && r.isAlone() && s.direction === 'out') {
      const only = r.view();
      logCall(s, 'missed');
      teardown(only.length === 1 ? (only[0].state === 'busy' ? 'Está en otra llamada' : only[0].state === 'declined' ? 'Llamada rechazada' : 'Sin respuesta') : 'Nadie ha respondido');
    }
  }, [logCall, teardown]);
  const afterChangeRef = useRef(afterChange);
  useEffect(() => { afterChangeRef.current = afterChange; });

  // ───────── start a call (one person or a group) ─────────
  const startCall = useCallback(async (input: CallPeer | CallPeer[], kind: CallKind, opts: StartOptions = {}) => {
    if (!user || !supported) return toast.show('Las llamadas necesitan un navegador compatible.', 'error');
    if (session.current) return toast.show('Ya estás en una llamada.', 'info');
    const peers = (Array.isArray(input) ? input : [input]).filter((p) => p.id !== user.id);
    if (!peers.length) return;
    if (peers.length > 5) return toast.show('Una llamada admite hasta 6 personas.', 'info');
    const callId = uuid();
    const room = buildRoom(callId, kind, peers);
    const me: CallPeer = { id: user.id, name: profile?.display_name ?? 'CIFRA', avatar: profile?.avatar_path };
    const s: Session = { callId, room, kind, direction: 'out', initiator: me, title: opts.title ?? null, answered: true, answerOnce: !!opts.answerOnce, conversationId: opts.conversationId, stopTone: null, logged: false };
    session.current = s; noticeRef.current = null;
    publish();
    // avatars of the invitees, best effort
    getProfiles(peers.map((p) => p.id)).then((cards) => { cards.forEach((c) => room.addMember({ id: c.id, name: c.display_name, avatar: c.avatar_path })); }).catch(() => {});
    try {
      const members = [me, ...peers].map((p) => ({ id: p.id, name: p.name }));
      await room.join(); // microphone / camera first: if it is denied nobody is rung
      if (session.current !== s) return;
      s.stopTone = startTone('ringback');
      await Promise.all(peers.map((p) => signal(p.id, 'invite', { callId, kind, name: me.name, members, title: s.title, answerOnce: s.answerOnce }).catch(() => room.onSignal('busy', p.id, {}))));
      s.ringTimer = setTimeout(() => {
        if (session.current !== s) return;
        const invited = room.view().filter((p) => p.state === 'invited').map((p) => p.id);
        invited.forEach((id) => signal(id, 'cancel', { callId }).catch(() => {}));
        if (!room.startedAt) { logCall(s, 'missed'); room.close(); teardown('Sin respuesta'); } else room.markMissed();
      }, RING_TIMEOUT);
    } catch (e) {
      room.close(); if (session.current === s) teardown();
      toast.show(e instanceof Error ? e.message : 'No se pudo iniciar la llamada.', 'error');
    }
  }, [user, supported, toast, buildRoom, publish, signal, logCall, teardown, profile?.display_name, profile?.avatar_path]);

  // ───────── answer / hang up ─────────
  const accept = useCallback(async () => {
    const s = session.current;
    if (!s || s.direction !== 'in' || s.answered) return;
    s.stopTone?.(); s.stopTone = null; clearTimeout(s.ringTimer);
    s.answered = true; publish();
    try { await s.room.join(); publish(); } catch (e) {
      s.room.memberIds().forEach((id) => signal(id, 'decline', { callId: s.callId }).catch(() => {}));
      teardown();
      toast.show(e instanceof Error ? e.message : 'No se pudo aceptar la llamada.', 'error');
    }
  }, [publish, signal, teardown, toast]);

  const hangUp = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const r = s.room;
    if (s.direction === 'in' && !s.answered) r.memberIds().forEach((id) => signal(id, 'decline', { callId: s.callId }).catch(() => {}));
    else if (!r.startedAt && s.direction === 'out') { r.memberIds().forEach((id) => signal(id, 'cancel', { callId: s.callId }).catch(() => {})); logCall(s, 'missed'); }
    else { if (s.direction === 'out') logCall(s, 'done'); r.leave(); }
    teardown();
  }, [signal, teardown, logCall]);

  // ───────── incoming signals ─────────
  const handle = useCallback(async (event: (typeof EVENTS)[number], p: Record<string, unknown>) => {
    const from = String(p.from ?? ''); const callId = String(p.callId ?? '');
    if (!from || !callId || !user) return;
    let s = session.current;

    if (event === 'invite') {
      if (s) { signal(from, 'busy', { callId }).catch(() => {}); return; }
      const kind: CallKind = p.kind === 'video' ? 'video' : 'audio';
      const raw = Array.isArray(p.members) ? (p.members as { id?: string; name?: string }[]) : [];
      const members: CallPeer[] = raw.filter((m) => m && typeof m.id === 'string' && m.id !== user.id).map((m) => ({ id: m.id!, name: String(m.name ?? 'Contacto').slice(0, 60) }));
      if (!members.some((m) => m.id === from)) members.push({ id: from, name: String(p.name ?? 'Contacto').slice(0, 60) });
      let initiator: CallPeer = members.find((m) => m.id === from)!;
      try { const cards = await getProfiles(members.map((m) => m.id)); cards.forEach((c) => { const m = members.find((x) => x.id === c.id); if (m) { m.name = c.display_name; m.avatar = c.avatar_path; } }); initiator = members.find((m) => m.id === from)!; } catch { /* keep the announced names */ }
      if (session.current) { signal(from, 'busy', { callId }).catch(() => {}); return; }
      const room = buildRoom(callId, kind, members);
      s = { callId, room, kind, direction: 'in', initiator, title: typeof p.title === 'string' ? p.title.slice(0, 80) : null, answered: false, answerOnce: p.answerOnce === true, stopTone: startTone('ring'), logged: false };
      s.ringTimer = setTimeout(() => { if (session.current === s && !s!.answered) { teardown('Llamada perdida'); } }, RING_TIMEOUT);
      session.current = s; noticeRef.current = null;
      room.onSignal('join', from, {}); // the person who calls is already in
      publish();
      try { navigator.vibrate?.([300, 200, 300, 200, 300]); } catch { /* not supported */ }
      try { if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('CIFRA', { body: t('{name} te está llamando', { name: initiator.name }), icon: '/icon-192.png', tag: 'cifra-call' }); } catch { /* optional */ }
      return;
    }

    if (!s || s.callId !== callId) return;

    // a team call that someone else already took: stop ringing here
    if (event === 'join' && s.direction === 'in' && !s.answered && s.answerOnce && from !== s.initiator.id) {
      const who = s.room.view().find((x) => x.id === from)?.name ?? '';
      teardown(who ? t('{name} atendió la llamada', { name: who }) : 'Otra persona atendió la llamada');
      return;
    }
    if (event === 'cancel' && s.direction === 'in' && !s.answered && from === s.initiator.id) { teardown('Llamada perdida'); return; }
    await s.room.onSignal(event, from, p);
    if (session.current === s) { publish(); afterChangeRef.current(); }
  }, [user, signal, buildRoom, publish, teardown]);

  const handleRef = useRef(handle); handleRef.current = handle;

  const userId = user?.id;
  useEffect(() => {
    if (!userId || !supported) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      try {
        await supabase.realtime.setAuth();
        if (cancelled) return;
        channel = supabase.channel(`call:${userId}`, { config: { private: true } });
        for (const ev of EVENTS) channel.on('broadcast', { event: ev }, ({ payload }) => { handleRef.current(ev, (payload ?? {}) as Record<string, unknown>); });
        channel.subscribe();
      } catch { /* calls unavailable: chat keeps working */ }
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); if (session.current) { session.current.room.leave(); session.current = null; } };
  }, [userId, supported]);

  const toggleMute = useCallback(() => { session.current?.room.toggleMute(); publish(); }, [publish]);
  const toggleCamera = useCallback(() => { session.current?.room.toggleCamera(); publish(); }, [publish]);
  const toggleShare = useCallback(async () => {
    const r = session.current?.room; if (!r) return;
    try { if (r.sharing) await r.stopShare(); else await r.startShare(); } catch (e) { if (!/NotAllowed|Permission|denied|AbortError/i.test(String(e))) toast.show('No se pudo compartir la pantalla.', 'error'); }
    publish();
  }, [publish, toast]);

  const value = useMemo(() => ({ supported, busy: !!view && view.phase !== 'idle', canShare: canShareScreen(), startCall }), [supported, view, startCall]);
  return (
    <CallCtx.Provider value={value}>
      {children}
      {Platform.OS === 'web' && view && <CallOverlay view={view} onAccept={accept} onHangUp={hangUp} onMute={toggleMute} onCamera={toggleCamera} onShare={toggleShare} />}
    </CallCtx.Provider>
  );
}
