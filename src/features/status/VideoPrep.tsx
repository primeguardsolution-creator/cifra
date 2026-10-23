import { createElement, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { friendly } from '../../lib/errors';
import { bytes } from '../../lib/format';
import { Picked } from '../../lib/media';
import { MAX_CLIP_S, MAX_HEIGHT, UPLOAD_CAP, VideoInfo, prepareVideo } from '../../lib/videoPrep';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Sheet, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Before publishing a video that is too long or too heavy: choose which part to keep (at most MAX_CLIP_S seconds) and the app
 * re-encodes it at up to 720p with a modest bitrate, so it plays quickly on mobile data. Web only (the PWA).
 */
export function VideoPrep({ visible, file, info, onClose, onDone }: { visible: boolean; file: Picked | null; info: VideoInfo | null; onClose: () => void; onDone: (f: Picked) => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const dur = info?.duration ?? 0;
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(dur, MAX_CLIP_S));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const preview = useRef<HTMLVideoElement | null>(null);
  const signal = useRef({ cancelled: false });
  useEffect(() => { if (visible) { setStart(0); setEnd(Math.min(dur, MAX_CLIP_S)); setBusy(false); setProgress(0); } }, [visible, file?.uri, dur]);
  if (Platform.OS !== 'web' || !file || !info) return null;

  const seek = (s: number) => { if (preview.current) preview.current.currentTime = s; };
  const moveStart = (v: number) => { const s = Math.min(v, Math.max(0, end - 1)); setStart(s); if (end - s > MAX_CLIP_S) setEnd(s + MAX_CLIP_S); seek(s); };
  const moveEnd = (v: number) => { const e = Math.max(v, start + 1); setEnd(e); if (e - start > MAX_CLIP_S) setStart(e - MAX_CLIP_S); seek(Math.max(0, e - 2)); };
  const range = (value: number, onChange: (v: number) => void, label: string) => createElement('input', {
    type: 'range', min: 0, max: Math.max(1, dur), step: 0.1, value, 'aria-label': label, disabled: busy,
    onChange: (e: { target: { value: string } }) => onChange(Number(e.target.value)),
    style: { width: '100%', accentColor: c.accent },
  });
  const trimmed = dur > 0 ? { start, end } : { start: 0, end: MAX_CLIP_S };
  const len = trimmed.end - trimmed.start;

  const run = async () => {
    signal.current = { cancelled: false }; setBusy(true); setProgress(0);
    try {
      const out = await prepareVideo(file, trimmed, info, setProgress, signal.current);
      if ((out.size ?? 0) > UPLOAD_CAP) throw new Error('El vídeo sigue siendo demasiado pesado: recorta un tramo más corto.');
      onDone(out);
    } catch (e) {
      if (String((e as Error).message) === 'cancelled') return;
      // This browser cannot re-encode it: publish the original when it fits, otherwise say so
      if ((file.size ?? 0) <= UPLOAD_CAP) { toast.show('No se pudo comprimir: se sube tal cual.', 'info'); onDone(file); }
      else toast.show(friendly(e, 'No se pudo preparar el vídeo.'), 'error');
    } finally { setBusy(false); }
  };
  const cancel = () => { signal.current.cancelled = true; if (!busy) onClose(); };

  const tooLong = dur > MAX_CLIP_S + 0.5;
  return (
    <Sheet visible={visible} onClose={cancel} title={tooLong ? 'Recorta tu vídeo' : 'Preparar vídeo'} scroll>
      <View style={{ gap: 14 }}>
        <Txt v="small" tone="muted">
          {tooLong ? t('Tu vídeo dura {d}. Elige un tramo de hasta {m} segundos.', { d: clock(dur), m: MAX_CLIP_S }) : t('Se ajusta a {h}p para que cargue rápido, también con poca cobertura.', { h: MAX_HEIGHT })}
        </Txt>
        <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center' }}>
          {createElement('video', { ref: (el: HTMLVideoElement | null) => { preview.current = el; }, src: file.uri, controls: true, playsInline: true, muted: true, preload: 'metadata', style: { width: '100%', maxHeight: 260, background: '#000' } })}
        </View>
        {dur > 0 && (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="smallStrong">{t('Inicio · {t}', { t: clock(start) })}</Txt><Txt v="smallStrong">{t('Fin · {t}', { t: clock(end) })}</Txt></View>
            {range(start, moveStart, 'Inicio del recorte')}
            {range(end, moveEnd, 'Fin del recorte')}
            <Txt v="caption" tone="muted">{t('Dura {d} · {size} originales', { d: clock(len), size: bytes(file.size) })}</Txt>
          </View>
        )}
        {busy && (
          <View style={{ gap: 6 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: c.sunken, overflow: 'hidden' }}><View style={{ width: `${Math.round(progress * 100)}%`, height: 8, backgroundColor: c.accent }} /></View>
            <Txt v="caption" tone="muted">{t('Preparando… {p}% · no cierres ni cambies de pestaña hasta que termine', { p: Math.round(progress * 100) })}</Txt>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Cancelar" variant="secondary" style={{ flex: 1 }} onPress={cancel} />
          <Button title="Preparar y continuar" icon="checkmark" style={{ flex: 2 }} loading={busy} onPress={run} />
        </View>
      </View>
    </Sheet>
  );
}
