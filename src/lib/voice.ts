import { Platform } from 'react-native';
import { Picked } from './media';

type AnyWindow = typeof globalThis & { webkitAudioContext?: typeof AudioContext; MediaRecorder?: typeof MediaRecorder };
const g = globalThis as AnyWindow;

/** Voice notes and calls rely on browser media APIs for now (PWA). */
export const voiceSupported = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof g.MediaRecorder !== 'undefined';

const TARGET_RATE = 16000;
export const MAX_VOICE_MS = 5 * 60 * 1000;

function pickMime(): string | undefined {
  const MR = g.MediaRecorder;
  if (!MR?.isTypeSupported) return undefined;
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => MR.isTypeSupported(m));
}

function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => { ctx.decodeAudioData(data, resolve, reject); });
}

/** Mono, 16 kHz, 16-bit PCM WAV: plays everywhere (including iOS Safari) and stays small enough for speech. */
function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function toWav(raw: Blob): Promise<{ blob: Blob; durationMs: number }> {
  const AC = g.AudioContext ?? g.webkitAudioContext!;
  const ctx = new AC();
  try {
    const decoded = await decode(ctx, await raw.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
    const off = new OfflineAudioContext(1, frames, TARGET_RATE);   // resampling + downmix to mono
    const src = off.createBufferSource();
    src.buffer = decoded; src.connect(off.destination); src.start();
    const rendered = await off.startRendering();
    return { blob: encodeWav(rendered.getChannelData(0), TARGET_RATE), durationMs: Math.round(decoded.duration * 1000) };
  } finally { ctx.close().catch(() => {}); }
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;

  /** Starts recording. `onLevel` receives 0..1 about ten times a second for the live meter. */
  async start(onLevel?: (level: number, elapsedMs: number) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = pickMime();
    this.recorder = new g.MediaRecorder!(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start(250);
    this.startedAt = Date.now();
    if (onLevel) {
      const AC = g.AudioContext ?? g.webkitAudioContext!;
      this.ctx = new AC();
      const analyser = this.ctx.createAnalyser(); analyser.fftSize = 512;
      this.ctx.createMediaStreamSource(this.stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      this.timer = setInterval(() => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
        onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4), Date.now() - this.startedAt);
      }, 100);
    }
  }

  private release() {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null; this.recorder = null; this.ctx = null;
  }

  cancel() {
    try { if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop(); } catch { /* already stopped */ }
    this.release(); this.chunks = [];
  }

  async stop(): Promise<Picked & { durationMs: number }> {
    const rec = this.recorder;
    if (!rec) throw new Error('No hay ninguna grabación en curso.');
    const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
    if (rec.state !== 'inactive') rec.stop();
    await done;
    const type = rec.mimeType || 'audio/webm';
    const raw = new Blob(this.chunks, { type });
    this.release();
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    try {
      const { blob, durationMs } = await toWav(raw);
      return { uri: URL.createObjectURL(blob), name: `voz-${stamp}.wav`, type: 'audio/wav', size: blob.size, durationMs };
    } catch {
      // decoding unsupported: send the original recording as is
      const base = type.split(';')[0];
      return { uri: URL.createObjectURL(raw), name: `voz-${stamp}.${base.includes('mp4') ? 'm4a' : 'webm'}`, type: base, size: raw.size, durationMs: Date.now() - this.startedAt };
    }
  }
}

export const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
