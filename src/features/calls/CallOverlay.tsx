import { createElement, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clock } from '../../lib/voice';
import { Avatar, Icon, IconName, Pressy, Txt } from '../../ui';
import { t } from '../../i18n';
import type { PeerView } from './mesh';
import type { CallView } from './CallProvider';

type Props = { view: CallView; onAccept: () => void; onHangUp: () => void; onMute: () => void; onCamera: () => void; onShare: () => void };

function Media({ stream, muted, style }: { stream: MediaStream | null; muted?: boolean; style: Record<string, unknown> }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) { ref.current.srcObject = stream; ref.current.play?.().catch(() => {}); } }, [stream]);
  return createElement('video', { ref, autoPlay: true, playsInline: true, muted, style });
}

function RoundButton({ icon, label, onPress, bg, fg = '#fff', size = 64, active, hangup }: { icon: IconName; label: string; onPress: () => void; bg: string; fg?: string; size?: number; active?: boolean; hangup?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Pressy onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scale={0.9} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: active === false ? 0.6 : 1 }}>
        <View style={hangup ? { transform: [{ rotate: '135deg' }] } : undefined}><Icon name={icon} size={size * 0.42} color={fg} /></View>
      </Pressy>
      <Txt v="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</Txt>
    </View>
  );
}

const HIDDEN = { position: 'absolute', width: 1, height: 1, opacity: 0 } as const;
const FILL = { width: '100%', height: '100%', background: '#000' } as const;

function Tile({ p, big }: { p: PeerView; big?: boolean }) {
  const hasVideo = !!p.stream && p.stream.getVideoTracks().length > 0 && !p.camOff;
  const label = p.state === 'connected' ? p.name : p.state === 'invited' ? t('{n} · llamando…', { n: p.name }) : p.state === 'connecting' ? t('{n} · conectando…', { n: p.name }) : p.state === 'declined' ? t('{n} · rechazó', { n: p.name }) : p.state === 'busy' ? t('{n} · ocupado', { n: p.name }) : p.state === 'missed' ? t('{n} · sin respuesta', { n: p.name }) : t('{n} · salió', { n: p.name });
  return (
    <View style={{ flexGrow: 1, flexBasis: big ? '100%' : 150, minHeight: big ? 0 : 140, flex: big ? 1 : undefined, borderRadius: 16, overflow: 'hidden', backgroundColor: '#13211B', alignItems: 'center', justifyContent: 'center' }}>
      <Media stream={p.stream} style={hasVideo ? { ...FILL, objectFit: p.sharing ? 'contain' : 'cover' } : HIDDEN} />
      {!hasVideo && <Avatar name={p.name} seed={p.id} path={p.avatar} size={big ? 120 : 64} />}
      <View style={{ position: 'absolute', left: 8, bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 1 }}><Txt v="caption" style={{ color: '#fff' }} numberOfLines={1}>{p.sharing ? t('{n} comparte pantalla', { n: p.name }) : label}</Txt></View>
        {p.muted && p.state === 'connected' && <Icon name="mic-off" size={14} color="#FF9C8B" />}
      </View>
    </View>
  );
}

export function CallOverlay({ view, onAccept, onHangUp, onMute, onCamera, onShare }: Props) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!view.startedAt) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [view.startedAt]);

  const video = view.kind === 'video';
  const connected = view.phase === 'connected';
  const incoming = view.phase === 'incoming';
  const ending = view.phase === 'idle';
  const peers = view.peers;
  const single = !view.group;
  const sharer = peers.find((p) => p.sharing && p.stream);
  const title = view.title ?? (single ? peers[0]?.name ?? view.initiator.name : peers.map((p) => p.name).join(', '));
  const status = view.notice ?? (view.reconnecting ? t('Reconectando…') : incoming ? (view.group ? (video ? t('Videollamada grupal entrante') : t('Llamada grupal entrante')) : video ? t('Videollamada entrante') : t('Llamada de voz entrante')) : view.phase === 'outgoing' ? t('Llamando…') : connected ? clock(now - (view.startedAt ?? now)) : t('Conectando…'));
  const showSingleVideo = single && video && !!peers[0]?.stream && peers[0].stream.getVideoTracks().length > 0 && !peers[0].camOff;
  const gridVisible = !incoming && (view.group || sharer);
  const others = sharer ? peers.filter((p) => p !== sharer) : peers;

  return (
    <View accessibilityViewIsModal accessibilityLabel={t('Llamada')} style={{ position: 'absolute', inset: 0, zIndex: 3000, backgroundColor: '#0A1511' } as object}>
      {/* audio of everyone stays mounted even in audio-only calls */}
      {!gridVisible && !showSingleVideo && peers.map((p) => <Media key={p.id} stream={p.stream} style={HIDDEN} />)}

      {single && !sharer && (
        showSingleVideo ? (
          <View style={{ position: 'absolute', inset: 0 } as object}><Media stream={peers[0].stream} style={{ ...FILL, objectFit: 'cover' }} /></View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 }}>
            <View style={{ borderRadius: 66, shadowColor: '#2FB583', shadowOpacity: 0.5, shadowRadius: 40 }}><Avatar name={title} seed={peers[0]?.id ?? view.initiator.id} path={peers[0]?.avatar ?? view.initiator.avatar} size={132} /></View>
            <Txt v="h1" style={{ color: '#fff', textAlign: 'center' }}>{title}</Txt>
            <Txt v="bodyStrong" style={{ color: view.notice ? '#FF9C8B' : 'rgba(255,255,255,0.75)' }}>{status}</Txt>
            {connected && !view.relay && <Txt v="caption" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('Conexión directa')}</Txt>}
          </View>
        )
      )}

      {incoming && view.group && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 }}>
          <Avatar name={view.initiator.name} seed={view.initiator.id} path={view.initiator.avatar} size={110} />
          <Txt v="h1" style={{ color: '#fff', textAlign: 'center' }}>{title}</Txt>
          <Txt v="body" style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{t('{n} te invita', { n: view.initiator.name })}</Txt>
          <Txt v="bodyStrong" style={{ color: 'rgba(255,255,255,0.75)' }}>{status}</Txt>
        </View>
      )}

      {gridVisible && (
        <View style={{ position: 'absolute', top: insets.top + 56, left: 10, right: 10, bottom: insets.bottom + 150, gap: 8 }}>
          {sharer && <Tile p={sharer} big />}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: sharer ? undefined : 1, height: sharer ? 120 : undefined, alignContent: 'stretch' }}>
            {others.map((p) => <Tile key={p.id} p={p} />)}
          </View>
        </View>
      )}

      {!incoming && (view.group || showSingleVideo || sharer) && (
        <View style={{ position: 'absolute', top: insets.top + 12, left: 0, right: 0, alignItems: 'center', gap: 2 }} pointerEvents="none">
          <Txt v="h3" style={{ color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }} numberOfLines={1}>{title}</Txt>
          <Txt v="small" style={{ color: 'rgba(255,255,255,0.9)', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }}>{status}</Txt>
        </View>
      )}

      {video && view.local && !ending && !incoming && (
        <View style={{ position: 'absolute', top: insets.top + 12, right: 12, width: 96, height: 136, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: '#000' }}>
          <Media stream={view.local} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: view.cameraOff ? 0.15 : 1 }} />
        </View>
      )}
      {view.sharing && !ending && (
        <View style={{ position: 'absolute', top: insets.top + 12, left: 12, backgroundColor: '#1FA67A', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}><Txt v="caption" style={{ color: '#fff' }}>{t('Compartiendo tu pantalla')}</Txt></View>
      )}

      {!ending && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 36, flexDirection: 'row', justifyContent: 'center', gap: 22, flexWrap: 'wrap' }}>
          {incoming ? (
            <>
              <RoundButton icon="call" label={t('Rechazar')} onPress={onHangUp} bg="#D8503F" size={72} hangup />
              <RoundButton icon={video ? 'videocam' : 'call'} label={t('Aceptar')} onPress={onAccept} bg="#1FA67A" size={72} />
            </>
          ) : (
            <>
              <RoundButton icon={view.muted ? 'mic-off' : 'mic'} label={view.muted ? t('Silenciado') : t('Silenciar')} onPress={onMute} bg={view.muted ? '#fff' : 'rgba(255,255,255,0.18)'} fg={view.muted ? '#111' : '#fff'} />
              {video && <RoundButton icon={view.cameraOff ? 'videocam-off' : 'videocam'} label={view.cameraOff ? t('Cámara apagada') : t('Cámara')} onPress={onCamera} bg={view.cameraOff ? '#fff' : 'rgba(255,255,255,0.18)'} fg={view.cameraOff ? '#111' : '#fff'} />}
              {view.canShare && connected && <RoundButton icon="desktop" label={view.sharing ? t('Dejar de compartir') : t('Compartir pantalla')} onPress={onShare} bg={view.sharing ? '#1FA67A' : 'rgba(255,255,255,0.18)'} />}
              <RoundButton icon="call" label={t('Colgar')} onPress={onHangUp} bg="#D8503F" hangup />
            </>
          )}
        </View>
      )}
    </View>
  );
}
