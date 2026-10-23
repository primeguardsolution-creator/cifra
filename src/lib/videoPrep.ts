import type { Picked } from './media';

/** Longest clip we publish, the 720p / bitrate budget that keeps a status light, and the hard upload cap. */
export const MAX_CLIP_S = 90;
export const MAX_HEIGHT = 720;
export const HEAVY_BYTES = 12 * 1024 * 1024;
export const UPLOAD_CAP = 25 * 1024 * 1024;
const BUDGET_BYTES = 18 * 1024 * 1024;

export type VideoInfo = { duration: number; width: number; height: number; size: number };
export type Trim = { start: number; end: number };

export const canPrepVideo = () => typeof document !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;

export function probeVideo(uri: string, size = 0): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      const info = { duration: Number.isFinite(v.duration) ? v.duration : 0, width: v.videoWidth, height: v.videoHeight, size };
      v.removeAttribute('src'); v.load();
      if (err || (!info.width && !info.duration)) reject(err ?? new Error('No se pudo leer el vídeo.')); else resolve(info);
    };
    // iPhone Safari reports the size at loadedmetadata but may never decode a frame of a detached video; some containers only know it at loadeddata
    v.onloadedmetadata = () => { if (v.videoWidth) finish(); };
    v.onloadeddata = () => finish();
    v.onerror = () => finish(new Error('No se pudo leer el vídeo.'));
    const timer = setTimeout(() => finish(), 6000); // never leave the picker hanging
    v.src = uri;
  });
}

/** Too long, too big or too sharp to publish as it is: the app trims and/or re-encodes it first. */
export const needsPrep = (i: VideoInfo) => i.duration > MAX_CLIP_S + 0.5 || i.size > HEAVY_BYTES || Math.min(i.width, i.height) > MAX_HEIGHT;

/** Bits per second so that `seconds` of video + audio stay under the byte budget (never above a sharp-but-light 2.5 Mbps). */
export const videoBitrate = (seconds: number) => Math.round(Math.max(600_000, Math.min(2_500_000, (BUDGET_BYTES * 8) / Math.max(seconds, 1) - 128_000)));

/** Output size: the short side is capped at 720 px (so portrait phone clips stay 720x1280 at most), both sides even for the encoder. */
export function targetSize(w: number, h: number) {
  const short = Math.min(w, h);
  const k = short > MAX_HEIGHT ? MAX_HEIGHT / short : 1;
  const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
  return { width: even(w), height: even(h) };
}

const pickMime = () => ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

/**
 * Plays the chosen part of the clip into a canvas and records it again at <=720p with a bitrate sized for a quick load on mobile data.
 * It runs at playback speed (a 60 s clip takes about 60 s) and the tab has to stay open. Mp4 where the browser can write it
 * (iPhone playback needs it), webm otherwise.
 */
export async function prepareVideo(src: Picked, trim: Trim, info: VideoInfo, onProgress: (p: number) => void, signal?: { cancelled: boolean }): Promise<Picked> {
  const { width, height } = targetSize(info.width || 1280, info.height || 720);
  const seconds = Math.max(0.5, trim.end - trim.start);
  const v = document.createElement('video');
  v.src = src.uri; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('No se pudo leer el vídeo.')), 12_000);
    v.onloadeddata = () => { clearTimeout(t); res(); }; v.onerror = () => { clearTimeout(t); rej(new Error('No se pudo leer el vídeo.')); };
    v.load();
  });
  // Prime playback inside the tap that started this (Safari only lets media play after a gesture)
  await v.play().catch(() => {}); v.pause();
  await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = trim.start; });

  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const stream = canvas.captureStream(30);
  let audioCtx: AudioContext | null = null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AC(); await audioCtx.resume().catch(() => {});
    const dest = audioCtx.createMediaStreamDestination();
    audioCtx.createMediaElementSource(v).connect(dest); // goes to the recording only: nothing plays aloud
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch { /* clips without a usable audio path are published silent */ }

  const mime = pickMime();
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: videoBitrate(seconds), audioBitsPerSecond: 96_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
  rec.start(500);
  let raf = 0;
  const draw = () => {
    ctx.drawImage(v, 0, 0, width, height);
    onProgress(Math.min(1, Math.max(0, (v.currentTime - trim.start) / seconds)));
    if (!signal?.cancelled && !v.ended && v.currentTime < trim.end - 0.04) raf = requestAnimationFrame(draw);
    else { cancelAnimationFrame(raf); v.pause(); setTimeout(() => rec.state !== 'inactive' && rec.stop(), 150); }
  };
  await v.play();
  raf = requestAnimationFrame(draw);
  await stopped;
  v.removeAttribute('src'); v.load(); audioCtx?.close().catch(() => {});
  if (signal?.cancelled) throw new Error('cancelled');
  const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  if (blob.size < 1024) throw new Error('No se pudo preparar el vídeo.');
  const ext = type.includes('mp4') ? 'mp4' : 'webm';
  onProgress(1);
  return { uri: URL.createObjectURL(blob), name: `video-${Date.now()}.${ext}`, type, size: blob.size, durationMs: Math.round(seconds * 1000) };
}
