import { Platform } from 'react-native';
import { supabase } from './supabase';

export const callsSupported = () => Platform.OS === 'web' && typeof RTCPeerConnection !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

const FALLBACK: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }];

/** STUN/TURN servers: Twilio relay through our Netlify function when configured, public STUN otherwise. */
export async function getIceServers(): Promise<{ servers: RTCIceServer[]; relay: boolean }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { servers: FALLBACK, relay: false };
    const res = await fetch('/api/ice', { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return { servers: FALLBACK, relay: false };
    const body = (await res.json()) as { iceServers?: RTCIceServer[]; relay?: boolean };
    return { servers: body.iceServers?.length ? body.iceServers : FALLBACK, relay: !!body.relay };
  } catch { return { servers: FALLBACK, relay: false }; }
}

/** Ring tones generated with WebAudio (no audio files to ship). */
export function startTone(kind: 'ring' | 'ringback'): () => void {
  const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return () => {};
  const ctx = new AC();
  ctx.resume().catch(() => {});
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination);
  const freqs = kind === 'ring' ? [440, 480] : [425];
  const oscs = freqs.map((f) => { const o = ctx.createOscillator(); o.frequency.value = f; o.type = 'sine'; o.connect(gain); o.start(); return o; });
  const on = kind === 'ring' ? 0.9 : 1.0; const period = kind === 'ring' ? 3000 : 4000;
  const tick = () => { const t = ctx.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(0.0001, t); gain.gain.linearRampToValueAtTime(kind === 'ring' ? 0.25 : 0.12, t + 0.05); gain.gain.setValueAtTime(kind === 'ring' ? 0.25 : 0.12, t + on); gain.gain.linearRampToValueAtTime(0.0001, t + on + 0.05); };
  tick();
  const timer = setInterval(tick, period);
  return () => { clearInterval(timer); try { oscs.forEach((o) => o.stop()); ctx.close(); } catch { /* already closed */ } };
}
