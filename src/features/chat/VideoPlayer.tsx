import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { font } from '../../theme/tokens';
import { Icon, IconButton, Pressy, Txt } from '../../ui';
import { t as tt } from '../../i18n';

const clock = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** Poster-like preview of a video inside a bubble: first frame, a big play button and the duration. */
export function VideoThumb({ url, width = 260, height = 200, pending, onOpen }: { url: string | null; width?: number; height?: number; pending?: boolean; onOpen: () => void }) {
  const { c } = useTheme();
  const [dur, setDur] = useState<number | null>(null);
  return (
    <Pressy onPress={onOpen} scale={0.98} accessibilityRole="button" accessibilityLabel="Reproducir vídeo" style={{ width, height, borderRadius: 14, overflow: 'hidden', backgroundColor: '#05050A' }}>
      {Platform.OS === 'web' && url
        ? createElement('video', { src: `${url}#t=0.1`, preload: 'metadata', muted: true, playsInline: true, onLoadedMetadata: (e: { currentTarget: HTMLVideoElement }) => setDur(e.currentTarget.duration), style: { width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', display: 'block' } })
        : null}
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.18)' } as object}>
        {pending || !url
          ? <ActivityIndicator color="#fff" />
          : <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={28} color="#fff" /></View>}
      </View>
      {dur != null && <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}><Icon name="videocam" size={11} color="#fff" /><Txt style={{ color: '#fff', fontSize: 11, lineHeight: 14, fontFamily: font.mono }}>{clock(dur)}</Txt></View>}
    </Pressy>
  );
}

const RATES = [1, 1.5, 2, 0.5];

function Ctl({ icon, label, onPress }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onPress: () => void }) {
  return <Pressy onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scale={0.88} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={24} color="#fff" /></Pressy>;
}

/** Full-screen player with CIFRA's own controls: tap to play/pause, scrub, speed, mute, full screen. */
export function VideoModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [ready, setReady] = useState(false);
  const [bar, setBar] = useState(true);
  const [trackW, setTrackW] = useState(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = useCallback(() => {
    setBar(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBar(false), 2800);
  }, []);
  useEffect(() => { if (url) { setT(0); setDur(0); setReady(false); setPlaying(false); setRate(1); poke(); } return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [url, poke]);

  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); poke(); };
  const seek = (ratio: number) => { const v = ref.current; if (v && dur) { v.currentTime = Math.max(0, Math.min(dur, ratio * dur)); setT(v.currentTime); } poke(); };
  const cycleRate = () => { const n = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; setRate(n); if (ref.current) ref.current.playbackRate = n; poke(); };
  const full = () => { const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null; if (!v) return; if (v.requestFullscreen) v.requestFullscreen().catch(() => {}); else v.webkitEnterFullscreen?.(); };

  // Native builds hand the file to the system player.
  useEffect(() => { if (url && Platform.OS !== 'web') { Linking.openURL(url).catch(() => {}); onClose(); } }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!url || Platform.OS !== 'web') return null;
  const pct = dur ? (t / dur) * 100 : 0;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center' }}>
        <Pressy onPress={toggle} scale={1} accessibilityRole="button" accessibilityLabel={playing ? 'Pausar' : 'Reproducir'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {createElement('video', {
            ref, src: url, autoPlay: true, playsInline: true, muted,
            onLoadedMetadata: (e: { currentTarget: HTMLVideoElement }) => { setDur(e.currentTarget.duration); setReady(true); },
            onTimeUpdate: (e: { currentTarget: HTMLVideoElement }) => setT(e.currentTarget.currentTime),
            onPlay: () => setPlaying(true), onPause: () => setPlaying(false), onEnded: () => { setPlaying(false); setBar(true); },
            onWaiting: () => setReady(false), onCanPlay: () => setReady(true),
            style: { maxWidth: '100%', maxHeight: '100%', width: '100%', height: '100%', objectFit: 'contain', outline: 'none', pointerEvents: 'none' },
          })}
          {!ready && <View style={{ position: 'absolute' }}><ActivityIndicator color="#fff" size="large" /></View>}
          {ready && !playing && (
            <View style={{ position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={40} color="#fff" /></View>
          )}
        </Pressy>

        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12, flexDirection: 'row', justifyContent: 'flex-end', opacity: bar || !playing ? 1 : 0 }}>
          <IconButton icon="close" label="Cerrar vídeo" onPress={onClose} size={46} filled />
        </View>

        <View onPointerMove={poke as never} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 14), paddingHorizontal: 16, paddingTop: 30, opacity: bar || !playing ? 1 : 0, backgroundColor: 'rgba(0,0,0,0.0)' }}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.5)' }} pointerEvents="none" />
          <Pressy onPress={(e) => { const x = (e.nativeEvent as { locationX?: number }).locationX ?? 0; seek(x / trackW); }} scale={1} accessibilityRole="adjustable" accessibilityLabel="Barra de progreso" style={{ height: 28, justifyContent: 'center' }}>
            <View onLayout={(e) => setTrackW(e.nativeEvent.layout.width || 1)} style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' }}>
              <View style={{ width: `${pct}%`, height: 5, borderRadius: 3, backgroundColor: c.highlight }} />
              <View style={{ position: 'absolute', left: `${pct}%`, top: -5, marginLeft: -7, width: 15, height: 15, borderRadius: 8, backgroundColor: '#fff' }} />
            </View>
          </Pressy>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <Ctl icon={playing ? 'pause' : 'play'} label={playing ? 'Pausar' : 'Reproducir'} onPress={toggle} />
            <Txt style={{ color: '#fff', fontFamily: font.mono, fontSize: 12 }}>{clock(t)} / {clock(dur)}</Txt>
            <View style={{ flex: 1 }} />
            <Pressy onPress={cycleRate} accessibilityRole="button" accessibilityLabel={tt('Velocidad {r}x', { r: rate })} scale={0.92} style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' }}><Txt style={{ color: '#fff', fontFamily: font.mono, fontSize: 12 }}>{rate}×</Txt></Pressy>
            <Ctl icon={muted ? 'volume-mute' : 'volume-high'} label={muted ? 'Activar sonido' : 'Silenciar'} onPress={() => { setMuted(!muted); poke(); }} />
            <Ctl icon="expand" label="Pantalla completa" onPress={full} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
