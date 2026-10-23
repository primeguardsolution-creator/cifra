import { Platform } from 'react-native';
import { supabase } from './supabase';
import { friendly } from './errors';
import { uuid } from './format';

export const MAX_UPLOAD = 25 * 1024 * 1024;

export function publicAvatarUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:/.test(path)) return path;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

const signed = new Map<string, { url: string; exp: number }>();
export async function signedMediaUrl(path: string): Promise<string | null> {
  const hit = signed.get(path);
  if (hit && hit.exp > Date.now() + 60_000) return hit.url;
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
  if (error || !data) return null;
  signed.set(path, { url: data.signedUrl, exp: Date.now() + 3600_000 });
  return data.signedUrl;
}

export type Picked = { uri: string; name: string; type: string; size?: number; durationMs?: number };

const extFor = (type: string, name: string) => {
  const fromName = name.includes('.') ? name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  if (fromName) return fromName;
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'application/pdf': 'pdf' } as Record<string, string>)[type] ?? 'bin';
};

async function toBody(file: Picked): Promise<Blob | ArrayBuffer> {
  const res = await fetch(file.uri);
  return Platform.OS === 'web' ? await res.blob() : await res.arrayBuffer();
}

export async function uploadMedia(bucket: 'chat-media' | 'avatars', folder: string, file: Picked): Promise<string> {
  const body = await toBody(file);
  const size = body instanceof Blob ? body.size : body.byteLength;
  if (size > MAX_UPLOAD) throw new Error('payload too large');
  const path = `${folder}/${uuid()}.${extFor(file.type, file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: file.type, upsert: false });
  if (error) throw new Error(friendly(error, 'No se pudo subir el archivo.'));
  return path;
}

// ───────── Pickers (photos, videos, documents, camera) ─────────
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

type Loaded = { w: number; h: number; draw: (ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number, sx: number, sy: number, sw: number, sh: number) => void };
function loadImage(uri: string): Promise<Loaded> {
  return new Promise((resolve, reject) => {
    const img = new (globalThis as unknown as { Image: new () => HTMLImageElement }).Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, draw: (ctx, dx, dy, dw, dh, sx, sy, sw, sh) => ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) });
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = uri;
  });
}

/** Web only: downscale (and optionally center-crop to a square) so uploads stay fast and light. */
async function processWebImage(file: Picked, opts: { max: number; square?: boolean }): Promise<Picked> {
  if (Platform.OS !== 'web' || file.type === 'image/gif') return file;
  const img = await loadImage(file.uri);
  const side = Math.min(img.w, img.h);
  const sx = opts.square ? (img.w - side) / 2 : 0;
  const sy = opts.square ? (img.h - side) / 2 : 0;
  const sw = opts.square ? side : img.w;
  const sh = opts.square ? side : img.h;
  const scale = Math.min(1, opts.max / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  img.draw(ctx, 0, 0, canvas.width, canvas.height, sx, sy, sw, sh);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  if (!blob) return file;
  return { uri: URL.createObjectURL(blob), name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', size: blob.size };
}

const fromAsset = (a: ImagePicker.ImagePickerAsset): Picked => ({
  uri: a.uri, name: a.fileName ?? `${a.type === 'video' ? 'video' : 'foto'}-${Date.now()}.${a.type === 'video' ? 'mp4' : 'jpg'}`,
  type: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'), size: a.fileSize,
});

/** Square profile/logo photo. */
export async function pickPhoto(opts: { square?: boolean; max?: number } = {}): Promise<Picked | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: !!opts.square && Platform.OS !== 'web', aspect: opts.square ? [1, 1] : undefined, quality: 0.85 });
  if (res.canceled || !res.assets[0]) return null;
  return processWebImage(fromAsset(res.assets[0]), { max: opts.max ?? (opts.square ? 640 : 1600), square: opts.square });
}

/** Photo or video for a chat. */
export async function pickChatMedia(): Promise<Picked | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 });
  if (res.canceled || !res.assets[0]) return null;
  const asset = fromAsset(res.assets[0]);
  return asset.type.startsWith('image/') ? processWebImage(asset, { max: 1800 }) : asset;
}

/** A video for a status / business post (up to the 25 MB upload limit; the picker reports the duration when it can). */
export async function pickVideo(): Promise<Picked | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.85, videoMaxDuration: 90 });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { ...fromAsset(a), durationMs: a.duration ?? undefined };
}

export async function takePhoto(): Promise<Picked | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Permite el acceso a la cámara para hacer fotos.');
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (res.canceled || !res.assets[0]) return null;
  return processWebImage(fromAsset(res.assets[0]), { max: 1800 });
}

export async function pickDocument(): Promise<Picked | null> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream', size: a.size };
}

/** Web: a picture the user chooses as chat background, shrunk and stored as a data URL so it survives reloads. Native: the picked file uri. */
export async function pickWallpaperImage(): Promise<string | null> {
  const f = await pickPhoto({ max: 1280 });
  if (!f) return null;
  if (Platform.OS !== 'web') return f.uri;
  const blob = await (await fetch(f.uri)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    r.readAsDataURL(blob);
  });
}
