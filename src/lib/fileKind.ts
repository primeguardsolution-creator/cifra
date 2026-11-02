import type { ImageSourcePropType } from 'react-native';
import type { IconName } from '../ui';

export type FileKind = 'pdf' | 'sheet' | 'doc' | 'slides' | 'text' | 'archive' | 'audio' | 'video' | 'image' | 'other';

const ext = (name?: string | null) => (name?.toLowerCase().match(/\.([a-z0-9]{1,6})$/)?.[1] ?? '');

/** What a shared file is, from its MIME type and name (names win when the MIME type is generic). */
export function fileKind(name?: string | null, mime?: string | null): FileKind {
  const e = ext(name); const m = (mime ?? '').toLowerCase();
  if (e === 'pdf' || m === 'application/pdf') return 'pdf';
  if (['xlsx', 'xls', 'xlsm', 'ods', 'csv', 'tsv', 'numbers'].includes(e) || m.includes('spreadsheet') || m.includes('excel') || m === 'text/csv') return 'sheet';
  if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(e) || m.includes('wordprocessing') || m === 'application/msword') return 'doc';
  if (['ppt', 'pptx', 'odp', 'key'].includes(e) || m.includes('presentation') || m.includes('powerpoint')) return 'slides';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e) || m.includes('zip') || m.includes('compressed')) return 'archive';
  if (['txt', 'md', 'json', 'xml', 'log', 'yml', 'yaml'].includes(e) || m.startsWith('text/') || m === 'application/json') return 'text';
  if (m.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac'].includes(e)) return 'audio';
  if (m.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(e)) return 'video';
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'].includes(e)) return 'image';
  return 'other';
}

/** Can the in-app reader open it? (PDF; .xlsx and CSV as tables; plain text.) */
export function isViewable(name?: string | null, mime?: string | null): boolean {
  const k = fileKind(name, mime); const e = ext(name);
  return k === 'pdf' || k === 'text' || (k === 'sheet' && ['xlsx', 'xlsm', 'csv', 'tsv'].includes(e));
}

export const fileKindMeta: Record<FileKind, { label: string; icon: IconName; color: string }> = {
  pdf: { label: 'PDF', icon: 'document-text', color: '#E5484D' },
  sheet: { label: 'Hoja de cálculo', icon: 'grid', color: '#1FA67A' },
  doc: { label: 'Documento', icon: 'document', color: '#3B7BFF' },
  slides: { label: 'Presentación', icon: 'easel', color: '#F08A24' },
  text: { label: 'Texto', icon: 'reader', color: '#6B7280' },
  archive: { label: 'Archivo comprimido', icon: 'archive', color: '#C58B2A' },
  audio: { label: 'Audio', icon: 'musical-notes', color: '#9B86FF' },
  video: { label: 'Vídeo', icon: 'videocam', color: '#E0355B' },
  image: { label: 'Imagen', icon: 'image', color: '#18B5C8' },
  other: { label: 'Archivo', icon: 'attach', color: '#7A8A84' },
};

/**
 * 3D artwork per kind (transparent WebP in assets/art/files/). Empty until the art exists: cards fall back to a coloured tile with a line icon.
 * To add one: save it as assets/art/files/<kind>.webp and add `pdf: require('../../assets/art/files/pdf.webp')` here.
 */
export const fileArt: Partial<Record<FileKind | 'location' | 'live-location' | 'contact' | 'event' | 'poll' | 'voice', ImageSourcePropType>> = {
  doc: require('../../assets/art/files/doc.webp'),
  video: require('../../assets/art/files/video.webp'),
  other: require('../../assets/art/files/other.webp'),
  contact: require('../../assets/art/files/contact.webp'),
  'live-location': require('../../assets/art/files/live-location.webp'),
};
