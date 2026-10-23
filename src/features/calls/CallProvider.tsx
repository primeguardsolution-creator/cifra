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
import { t } from '../../i18n';

export type CallKind = 'audio' | 'video';
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected';
export type CallPeer = { id: string; name: string; avatar?: string | null };
export type CallView = {
  phase: CallPhase; peer: CallPeer; kind: CallKind; direction: 'out' | 'in'; startedAt: number | null; muted: boolean; cameraOff: boolean;
  local: MediaStream | null; remote: MediaStream | null; reconnecting: boolean; notice: string | null; relay: boolean;
};

type Ctx = { supported: boolean; busy: boolean; startCall: (peer: CallPeer, kind: CallKind) => Promise<void> };
const CallCtx = createContext<Ctx>({ supported: false, busy: false, startCall: async () => {} });
export const useCall = () => useContext(CallCtx);

type Session = {
  callId: string; peer: CallPeer; kind: CallKind; direction: 'out' | 'in'; pc: RTCPeerConnection | null; local: MediaStream | null; remote: MediaStream | null;
  pendingIce: RTCIceCandidateInit[]; stopTone: (() => void) | null; ringTimer?: ReturnType<typeof setTimeout>; dropTimer?: ReturnType<typeof setTimeout>;
  startedAt: number | null; answered: boolean; relay: boolean;
};

const EVENTS = ['invite', 'accept', 'offer', 'answer', 'ice', 'decline', 'busy', 'cancel', 'end'] as const;
const RING_TIMEOUT = 45_000;

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const supported = callsSupported();
  const [view, setView] = useState<CallView | null>(null);
  const session = useRef<Session | null>(null);
  const flags = useRef({ muted: false, cameraOff: false, reconnecting: false, notice: null as string | null });

  const publish = useCallback(() => {
    const s = session.current;
    if (!s) { setView(null); return; }
    const phase: CallPhase = s.startedAt ? 'connected' : s.direction === 'in' && !s.answered ? 'incoming' : s.answered || s.pc ? 'connecting' : 'outgoing';
    setView({ phase, peer: s.peer, kind: s.kind, direction: s.direction, startedAt: s.startedAt, local: s.local, remote: s.remote, relay: s.relay, ...flags.current });
  }, []);

  const signal = useCallback(async (to: string, event: (typeof EVENTS)[number], payload: Record<string, unknown>) => {
    const { error } = await supabase.rpc('send_call_signal', { p_to: to, p_event: event, p_payload: payload });
    if (error) throw new Error(friendly(error));
  }, []);

  const logCall = useCallback(async (s: Session, outcome: 'done' | 'missed') => {
    if (!user || s.direction !== 'out') return;
    const icon = s.kind === 'video' ? '📹' : '📞';
    const label = s.kind === 'video' ? 'Videollamada' : 'Llamada de voz';
    const secs = s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0;
    const body = outcome === 'done' && s.startedAt ? `${icon} ${label} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${icon} ${label} sin respuesta`;
    try { const conv = await startDirectChat(s.peer.id); await sendMessage({ id: uuid(), conversation_id: conv, sender_id: user.id, body }); } catch { /* the call log is best effort */ }
  }, [user]);

  const teardown = useCallback((notice?: string) => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    clearTimeout(s.ringTimer); clearTimeout(s.dropTimer); s.stopTone?.();
    s.pc?.getSenders().forEach((x) => x.track?.stop());
    try { s.pc?.close(); } catch { /* closed */ }
    s.local?.getTracks().forEach((t) => t.stop());
    flags.current = { muted: false, cameraOff: false, reconnecting: false, notice: notice ?? null };
    if (notice) {
      setView((v) => (v ? { ...v, phase: 'idle', local: null, remote: null, notice } : v));
      setTimeout(() => { if (!session.current) setView(null); }, 1800);
    } else setView(null);
  }, []);

  const getMedia = useCallback(async (kind: CallKind) => {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: kind === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false });
    } catch (e) {
      throw new Error(/NotAllowed|denied|Permission/i.test(String(e)) ? (kind === 'video' ? 'Permite el micrófono y la cámara para llamar.' : 'Permite el micrófono para llamar.') : (kind === 'video' ? 'No se pudo acceder al micrófono o la cámara.' : 'No se pudo acceder al micrófono.'));
    }
  }, []);

  const buildPeerConnection = useCallback(async (s: Session) => {
    const { servers, relay } = await getIceServers();
    s.relay = relay;
    const pc = new RTCPeerConnection({ iceServers: servers });
    s.pc = pc;
    s.remote = new MediaStream();
    s.local?.getTracks().forEach((t) => pc.addTrack(t, s.local!));
    pc.ontrack = (e) => { e.streams[0]?.getTracks().forEach((t) => { if (!s.remote!.getTracks().includes(t)) s.remote!.addTrack(t); }); if (!s.remote!.getTracks().length) s.remote!.addTrack(e.track); publish(); };
    pc.onicecandidate = (e) => { if (e.candidate) signal(s.peer.id, 'ice', { callId: s.callId, candidate: e.candidate.toJSON() }).catch(() => {}); };
    pc.onconnectionstatechange = () => {
      if (session.current !== s) return;
      if (pc.connectionState === 'connected') { clearTimeout(s.dropTimer); flags.current.reconnecting = false; if (!s.startedAt) s.startedAt = Date.now(); s.stopTone?.(); s.stopTone = null; publish(); }
      else if (pc.connectionState === 'disconnected') { flags.current.reconnecting = true; publish(); clearTimeout(s.dropTimer); s.dropTimer = setTimeout(() => { if (session.current === s) { signal(s.peer.id, 'end', { callId: s.callId }).catch(() => {}); logCall(s, 'done'); teardown('Se perdió la conexión'); } }, 12_000); }
      else if (pc.connectionState === 'failed') { signal(s.peer.id, 'end', { callId: s.callId }).catch(() => {}); logCall(s, s.startedAt ? 'done' : 'missed'); teardown('No se pudo conectar la llamada'); }
    };
    publish();
    return pc;
  }, [publish, signal, teardown, logCall]);

  const flushIce = useCallback(async (s: Session) => {
    const queued = s.pendingIce.splice(0);
    for (const c of queued) { try { await s.pc?.addIceCandidate(c); } catch { /* stale candidate */ } }
  }, []);

  // ───────── caller ─────────
  const startCall = useCallback(async (peer: CallPeer, kind: CallKind) => {
    if (!user || !supported) return toast.show('Las llamadas necesitan un navegador compatible.', 'error');
    if (session.current) return toast.show('Ya estás en una llamada.', 'info');
    const s: Session = { callId: uuid(), peer, kind, direction: 'out', pc: null, local: null, remote: null, pendingIce: [], stopTone: null, startedAt: null, answered: false, relay: false };
    session.current = s; flags.current = { muted: false, cameraOff: false, reconnecting: false, notice: null };
    publish();
    try {
      s.local = await getMedia(kind);
      if (session.current !== s) { s.local.getTracks().forEach((t) => t.stop()); return; }
      publish();
      await signal(peer.id, 'invite', { callId: s.callId, kind, name: profile?.display_name ?? 'CIFRA' });
      s.stopTone = startTone('ringback');
      s.ringTimer = setTimeout(() => { if (session.current === s && !s.startedAt) { signal(peer.id, 'cancel', { callId: s.callId }).catch(() => {}); logCall(s, 'missed'); teardown('Sin respuesta'); } }, RING_TIMEOUT);
    } catch (e) {
      teardown();
      toast.show(e instanceof Error ? e.message : 'No se pudo iniciar la llamada.', 'error');
    }
  }, [user, supported, toast, publish, signal, getMedia, teardown, logCall, profile?.display_name]);

  // ───────── callee ─────────
  const accept = useCallback(async () => {
    const s = session.current;
    if (!s || s.direction !== 'in' || s.answered) return;
    s.stopTone?.(); s.stopTone = null; clearTimeout(s.ringTimer);
    s.answered = true; publish();
    try {
      s.local = await getMedia(s.kind);
      await buildPeerConnection(s);
      await signal(s.peer.id, 'accept', { callId: s.callId });
    } catch (e) {
      signal(s.peer.id, 'decline', { callId: s.callId }).catch(() => {});
      teardown();
      toast.show(e instanceof Error ? e.message : 'No se pudo aceptar la llamada.', 'error');
    }
  }, [publish, getMedia, buildPeerConnection, signal, teardown, toast]);

  const hangUp = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const event = s.startedAt ? 'end' : s.direction === 'in' ? 'decline' : 'cancel';
    signal(s.peer.id, event, { callId: s.callId }).catch(() => {});
    if (s.direction === 'out') logCall(s, s.startedAt ? 'done' : 'missed');
    teardown();
  }, [signal, teardown, logCall]);

  // ───────── incoming signals ─────────
  const handle = useCallback(async (event: (typeof EVENTS)[number], p: Record<string, unknown>) => {
    const from = String(p.from ?? ''); const callId = String(p.callId ?? '');
    if (!from || !callId) return;
    let s = session.current;

    if (event === 'invite') {
      if (s) { signal(from, 'busy', { callId }).catch(() => {}); return; }
      const kind: CallKind = p.kind === 'video' ? 'video' : 'audio';
      let peer: CallPeer = { id: from, name: String(p.name ?? 'Contacto').slice(0, 60) };
      try { const card = (await getProfiles([from]))[0]; if (card) peer = { id: from, name: card.display_name, avatar: card.avatar_path }; } catch { /* keep the announced name */ }
      if (session.current) { signal(from, 'busy', { callId }).catch(() => {}); return; }
      s = { callId, peer, kind, direction: 'in', pc: null, local: null, remote: null, pendingIce: [], stopTone: startTone('ring'), startedAt: null, answered: false, relay: false };
      s.ringTimer = setTimeout(() => { if (session.current === s && !s!.answered) teardown('Llamada perdida'); }, RING_TIMEOUT);
      session.current = s; flags.current = { muted: false, cameraOff: false, reconnecting: false, notice: null };
      publish();
      try { navigator.vibrate?.([300, 200, 300, 200, 300]); } catch { /* not supported */ }
      try { if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('CIFRA', { body: t('{name} te está llamando', { name: peer.name }), icon: '/icon-192.png', tag: 'cifra-call' }); } catch { /* optional */ }
      return;
    }

    if (!s || s.callId !== callId || s.peer.id !== from) return;

    switch (event) {
      case 'accept': {                       // caller: the other side picked up → start negotiating
        if (s.direction !== 'out' || s.pc) return;
        s.stopTone?.(); s.stopTone = null; clearTimeout(s.ringTimer); s.answered = true; publish();
        try {
          const pc = await buildPeerConnection(s);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await signal(from, 'offer', { callId, sdp: offer.sdp, type: offer.type });
        } catch { signal(from, 'end', { callId }).catch(() => {}); teardown('No se pudo conectar la llamada'); }
        break;
      }
      case 'offer': {                        // callee: answer it
        if (!s.pc) return;
        try {
          await s.pc.setRemoteDescription({ type: 'offer', sdp: String(p.sdp) });
          await flushIce(s);
          const answer = await s.pc.createAnswer();
          await s.pc.setLocalDescription(answer);
          await signal(from, 'answer', { callId, sdp: answer.sdp, type: answer.type });
        } catch { signal(from, 'end', { callId }).catch(() => {}); teardown('No se pudo conectar la llamada'); }
        break;
      }
      case 'answer': {
        if (!s.pc) return;
        try { await s.pc.setRemoteDescription({ type: 'answer', sdp: String(p.sdp) }); await flushIce(s); } catch { teardown('No se pudo conectar la llamada'); }
        break;
      }
      case 'ice': {
        const cand = p.candidate as RTCIceCandidateInit | undefined;
        if (!cand) return;
        if (s.pc?.remoteDescription) { try { await s.pc.addIceCandidate(cand); } catch { /* stale */ } } else s.pendingIce.push(cand);
        break;
      }
      case 'decline': logCall(s, 'missed'); teardown('Llamada rechazada'); break;
      case 'busy': logCall(s, 'missed'); teardown('Está en otra llamada'); break;
      case 'cancel': teardown('Llamada perdida'); break;
      case 'end': if (s.direction === 'out') logCall(s, 'done'); teardown('Llamada finalizada'); break;
    }
  }, [signal, publish, teardown, buildPeerConnection, flushIce, logCall]);

  const handleRef = useRef(handle);
  handleRef.current = handle;

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
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); session.current && teardown(); };
  }, [userId, supported, teardown]);

  const toggleMute = useCallback(() => {
    const s = session.current; if (!s?.local) return;
    flags.current.muted = !flags.current.muted;
    s.local.getAudioTracks().forEach((t) => { t.enabled = !flags.current.muted; });
    publish();
  }, [publish]);
  const toggleCamera = useCallback(() => {
    const s = session.current; if (!s?.local) return;
    flags.current.cameraOff = !flags.current.cameraOff;
    s.local.getVideoTracks().forEach((t) => { t.enabled = !flags.current.cameraOff; });
    publish();
  }, [publish]);

  const value = useMemo(() => ({ supported, busy: !!view && view.phase !== 'idle', startCall }), [supported, view, startCall]);
  return (
    <CallCtx.Provider value={value}>
      {children}
      {Platform.OS === 'web' && view && <CallOverlay view={view} onAccept={accept} onHangUp={hangUp} onMute={toggleMute} onCamera={toggleCamera} />}
    </CallCtx.Provider>
  );
}
