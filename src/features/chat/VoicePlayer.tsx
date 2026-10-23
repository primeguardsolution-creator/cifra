import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Platform, View } from 'react-native';
import { Message } from '../../lib/api';
import { signedMediaUrl } from '../../lib/media';
import { clock } from '../../lib/voice';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Pressy, Txt } from '../../ui';
import { t } from '../../i18n';

const BARS = 32;
const RATES = [1, 1.5, 2];
let playingNow: { audio: HTMLAudioElement; stop: () => void } | null = null; // one voice note at a time

function barsFor(seed: string) {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: BARS }, (_, i) => { h = (h * 1103515245 + 12345) | 0; return 0.25 + ((Math.abs(h) >> 8) % 100) / 140 + (i % 7 === 3 ? 0.1 : 0); });
}

export function VoicePlayer({ m, mine }: { m: Message; mine: boolean }) {
  const { c } = useTheme();
  const [url, setUrl] = useState<string | null>(m.localUri ?? null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bars = useMemo(() => barsFor(m.id), [m.id]);
  const total = m.attachment_duration_ms ?? 0;

  useEffect(() => {
    let live = true;
    if (m.localUri) setUrl(m.localUri);
    else if (m.attachment_path) signedMediaUrl(m.attachment_path).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [m.attachment_path, m.localUri]);

  useEffect(() => () => { audioRef.current?.pause(); if (playingNow?.audio === audioRef.current) playingNow = null; }, []);

  const toggle = async () => {
    if (Platform.OS !== 'web' || !url) return;
    if (!audioRef.current) {
      const a = new Audio(url);
      a.preload = 'auto';
      a.ontimeupdate = () => { const d = a.duration && isFinite(a.duration) ? a.duration * 1000 : total; if (d) setProgress(Math.min(1, (a.currentTime * 1000) / d)); };
      a.onended = () => { setPlaying(false); setProgress(0); a.currentTime = 0; };
      a.onerror = () => { setFailed(true); setPlaying(false); };
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (playing) { a.pause(); setPlaying(false); return; }
    if (playingNow && playingNow.audio !== a) playingNow.stop();
    a.playbackRate = rate;
    try { await a.play(); setPlaying(true); playingNow = { audio: a, stop: () => { a.pause(); setPlaying(false); } }; } catch { setFailed(true); }
  };

  const seek = (x: number) => {
    const a = audioRef.current; if (!a || !width) return;
    const d = a.duration && isFinite(a.duration) ? a.duration : total / 1000; if (!d) return;
    a.currentTime = Math.max(0, Math.min(1, x / width)) * d; setProgress(a.currentTime / d);
  };

  const fg = mine ? c.bubbleOutText : c.bubbleInText;
  const dim = mine ? 'rgba(255,255,255,0.35)' : c.borderStrong;
  const on = mine ? c.bubbleOutText : c.accent;
  const shown = playing || progress > 0 ? Math.round(total * progress) : total;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 250, paddingVertical: 2 }}>
      <Pressy onPress={toggle} disabled={!url || failed} accessibilityRole="button" accessibilityLabel={playing ? 'Pausar mensaje de voz' : 'Reproducir mensaje de voz'} scale={0.9}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: mine ? 'rgba(255,255,255,0.18)' : c.accent, alignItems: 'center', justifyContent: 'center' }}>
        {m.pending || (!url && !failed) ? <ActivityIndicator color={mine ? c.bubbleOutText : c.accentText} size="small" /> : <Icon name={failed ? 'alert' : playing ? 'pause' : 'play'} size={20} color={mine ? c.bubbleOutText : c.accentText} />}
      </Pressy>
      <View style={{ flex: 1, gap: 3 }}>
        <Pressy onPress={(e) => seek((e.nativeEvent as unknown as { locationX: number }).locationX)} scale={1} accessibilityLabel="Posición del audio"
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: 28, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {bars.map((h, i) => <View key={i} style={{ flex: 1, height: 28 * Math.min(1, h), borderRadius: 2, backgroundColor: i / BARS < progress ? on : dim }} />)}
        </Pressy>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="mono" style={{ color: mine ? c.bubbleOutMeta : c.textMuted, fontSize: 10 }}>{failed ? 'No se pudo reproducir' : clock(shown)}</Txt>
          <Pressy onPress={() => { const n = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; setRate(n); if (audioRef.current) audioRef.current.playbackRate = n; }} accessibilityRole="button" accessibilityLabel={t('Velocidad {r}x', { r: rate })} scale={0.9}
            style={{ paddingHorizontal: 7, height: 18, borderRadius: 9, backgroundColor: mine ? 'rgba(255,255,255,0.14)' : c.sunken, justifyContent: 'center' }}>
            <Txt style={{ color: fg, fontSize: 10, lineHeight: 12, fontFamily: 'GeistMono_500Medium' }}>{rate}×</Txt>
          </Pressy>
        </View>
      </View>
    </View>
  );
}
