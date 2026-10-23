import { createElement, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clock } from '../../lib/voice';
import { Avatar, Icon, IconName, Pressy, Txt } from '../../ui';
import type { CallView } from './CallProvider';

type Props = { view: CallView; onAccept: () => void; onHangUp: () => void; onMute: () => void; onCamera: () => void };

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

export function CallOverlay({ view, onAccept, onHangUp, onMute, onCamera }: Props) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!view.startedAt) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [view.startedAt]);

  const video = view.kind === 'video';
  const connected = view.phase === 'connected';
  const showRemoteVideo = video && !!view.remote && view.remote.getVideoTracks().length > 0;
  const status = view.notice ?? (view.reconnecting ? 'Reconectando…' : view.phase === 'incoming' ? (video ? 'Videollamada entrante' : 'Llamada de voz entrante') : view.phase === 'outgoing' ? 'Llamando…' : connected ? clock(now - (view.startedAt ?? now)) : 'Conectando…');
  const ending = view.phase === 'idle';

  return (
    <View accessibilityViewIsModal accessibilityLabel="Llamada" style={{ position: 'absolute', inset: 0, zIndex: 3000, backgroundColor: '#0A1511' } as object}>
      {/* remote media: always mounted so audio plays, hidden when audio only */}
      <Media stream={view.remote} style={showRemoteVideo ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000' } : { position: 'absolute', width: 1, height: 1, opacity: 0 }} />

      {!showRemoteVideo && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 }}>
          <View style={{ borderRadius: 66, shadowColor: '#2FB583', shadowOpacity: 0.5, shadowRadius: 40 }}><Avatar name={view.peer.name} seed={view.peer.id} path={view.peer.avatar} size={132} /></View>
          <Txt v="h1" style={{ color: '#fff', textAlign: 'center' }}>{view.peer.name}</Txt>
          <Txt v="bodyStrong" style={{ color: view.notice ? '#FF9C8B' : 'rgba(255,255,255,0.75)' }}>{status}</Txt>
          {connected && !view.relay && <Txt v="caption" style={{ color: 'rgba(255,255,255,0.45)' }}>Conexión directa</Txt>}
        </View>
      )}

      {showRemoteVideo && (
        <View style={{ position: 'absolute', top: insets.top + 14, left: 0, right: 0, alignItems: 'center', gap: 2 }} pointerEvents="none">
          <Txt v="h3" style={{ color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }}>{view.peer.name}</Txt>
          <Txt v="small" style={{ color: 'rgba(255,255,255,0.9)', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }}>{status}</Txt>
        </View>
      )}

      {video && view.local && !ending && (
        <View style={{ position: 'absolute', top: insets.top + 14, right: 14, width: 104, height: 148, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: '#000' }}>
          <Media stream={view.local} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: view.cameraOff ? 0.15 : 1 }} />
        </View>
      )}

      {!ending && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 36, flexDirection: 'row', justifyContent: 'center', gap: 28, flexWrap: 'wrap' }}>
          {view.phase === 'incoming' ? (
            <>
              <RoundButton icon="call" label="Rechazar" onPress={onHangUp} bg="#D8503F" size={72} hangup />
              <RoundButton icon={video ? 'videocam' : 'call'} label="Aceptar" onPress={onAccept} bg="#1FA67A" size={72} />
            </>
          ) : (
            <>
              <RoundButton icon={view.muted ? 'mic-off' : 'mic'} label={view.muted ? 'Silenciado' : 'Silenciar'} onPress={onMute} bg={view.muted ? '#fff' : 'rgba(255,255,255,0.18)'} fg={view.muted ? '#111' : '#fff'} />
              {video && <RoundButton icon={view.cameraOff ? 'videocam-off' : 'videocam'} label={view.cameraOff ? 'Cámara apagada' : 'Cámara'} onPress={onCamera} bg={view.cameraOff ? '#fff' : 'rgba(255,255,255,0.18)'} fg={view.cameraOff ? '#111' : '#fff'} />}
              <RoundButton icon="call" label="Colgar" onPress={onHangUp} bg="#D8503F" hangup />
            </>
          )}
        </View>
      )}
    </View>
  );
}
