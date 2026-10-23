import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, Modal, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusRow } from '../../lib/api';
import { relative } from '../../lib/format';
import { signedMediaUrl } from '../../lib/media';
import { LinkCard } from '../../components/LinkCard';
import { firstUrl } from '../../lib/linkPreview';
import { statusBackgrounds } from '../../theme/tokens';
import { Avatar, Icon, IconButton, Pressy, Txt } from '../../ui';
import { t } from '../../i18n';

type Props = {
  visible: boolean; items: StatusRow[]; name: string; avatarPath?: string | null; seed: string; mine?: boolean; onClose: () => void; onDelete?: (s: StatusRow) => void;
  /** Business posts: show the storefront badge and a "Escribir" call to action that opens the public profile. */
  business?: { id: string; handle?: string | null } | null;
};
const DURATION = 5500;
const MAX_VIDEO = 90_000;

/** Full-screen story viewer: text on a gradient, photos and (web) autoplaying videos, with per-item progress bars. */
export function StatusViewer({ visible, items, name, avatarPath, seed, mine, onClose, onDelete, business }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [media, setMedia] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const current = items[index];

  useEffect(() => { if (visible) setIndex(0); }, [visible]);

  const next = useCallback(() => setIndex((i) => { if (i + 1 >= items.length) { onClose(); return i; } return i + 1; }), [items.length, onClose]);
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  const run = useCallback((ms: number) => {
    anim.current?.stop();
    progress.setValue(0);
    anim.current = Animated.timing(progress, { toValue: 1, duration: ms, useNativeDriver: false });
    anim.current.start(({ finished }) => finished && next());
  }, [progress, next]);

  useEffect(() => {
    if (!visible || !current) return;
    setMedia(null);
    let live = true;
    if (current.media_path) signedMediaUrl(current.media_path).then((u) => live && setMedia(u));
    // Videos start their own timer once we know how long they are (web); everything else runs the fixed duration.
    if (current.kind !== 'video' || Platform.OS !== 'web') run(current.kind === 'video' ? 12_000 : DURATION);
    return () => { live = false; anim.current?.stop(); };
  }, [visible, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !current) return null;
  const [from, to] = statusBackgrounds[current.bg % statusBackgrounds.length];
  const isVideo = current.kind === 'video';
  const linkUrl = firstUrl(current.body);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 520 }}>
          {current.kind === 'text'
            ? <LinearGradient colors={[from, to]} style={{ position: 'absolute', inset: 0 } as object} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            : isVideo
              ? media && Platform.OS === 'web'
                ? createElement('video', {
                  key: current.id, src: media, autoPlay: true, playsInline: true, muted: false,
                  onLoadedMetadata: (e: { currentTarget: HTMLVideoElement }) => run(Math.min(MAX_VIDEO, Math.max(1500, (e.currentTarget.duration || 10) * 1000))),
                  onEnded: next,
                  style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' },
                })
                : media ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Pressy onPress={() => Linking.openURL(media)} accessibilityRole="button" accessibilityLabel="Reproducir vídeo" scale={0.94} style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={40} color="#fff" /></Pressy></View> : null
              : media ? <Image source={{ uri: media }} resizeMode="contain" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' } as object} /> : null}
          {current.kind === 'text' && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 }}><Txt style={{ color: '#fff', fontSize: 30, lineHeight: 38, textAlign: 'center', fontFamily: 'Inter_700Bold' }}>{current.body}</Txt></View>}
          {current.kind !== 'text' && current.body ? <View style={{ position: 'absolute', bottom: insets.bottom + (business ? 96 : 40), left: 0, right: 0, padding: 20, backgroundColor: 'rgba(0,0,0,0.45)' }}><Txt style={{ color: '#fff', textAlign: 'center' }}>{current.body}</Txt></View> : null}

          <View style={{ position: 'absolute', inset: 0, flexDirection: 'row' } as object}>
            <Pressy onPress={prev} style={{ flex: 1 }} scale={1} accessibilityLabel="Anterior"><View style={{ flex: 1 }} /></Pressy>
            <Pressy onPress={next} style={{ flex: 2 }} scale={1} accessibilityLabel="Siguiente"><View style={{ flex: 1 }} /></Pressy>
          </View>
          {linkUrl && <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + (business ? 96 : 40) + (current.kind !== 'text' && current.body ? 78 : 0), zIndex: 3 }}><LinkCard url={linkUrl} dark /></View>}


          <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 12, gap: 10 }} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {items.map((s, i) => (
                <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
                  <Animated.View style={{ height: 3, backgroundColor: '#fff', width: i < index ? '100%' : i === index ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={name} seed={seed} path={avatarPath} size={38} business={!!business} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Txt v="smallStrong" style={{ color: '#fff' }}>{mine && !business ? 'Mi estado' : name}</Txt>{business && <Icon name="storefront" size={13} color="#FFD98A" />}</View>
                <Txt v="caption" style={{ color: 'rgba(255,255,255,0.75)' }}>{isVideo ? t('{when} · vídeo', { when: relative(current.created_at) }) : relative(current.created_at)}</Txt>
              </View>
              {mine && onDelete && <IconButton icon="trash" label={business ? 'Eliminar publicación' : 'Eliminar estado'} size={40} onPress={() => { onDelete(current); if (items.length === 1) onClose(); else next(); }} />}
              <IconButton icon="close" label="Cerrar" size={40} onPress={onClose} />
            </View>
          </View>

          {business && !mine && (
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 24, flexDirection: 'row', gap: 10 }} pointerEvents="box-none">
              <Pressy onPress={() => { onClose(); router.push({ pathname: '/b/[id]', params: { id: business.id } }); }} accessibilityRole="button" accessibilityLabel="Ver perfil del negocio" scale={0.96} style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                <Icon name="storefront" size={18} color="#16160F" /><Txt v="smallStrong" style={{ color: '#16160F' }}>Ver perfil y catálogo</Txt>
              </Pressy>
              <Pressy onPress={() => { onClose(); router.push({ pathname: '/b/[id]', params: { id: business.id, chat: '1' } }); }} accessibilityRole="button" accessibilityLabel="Escribir al negocio" scale={0.96} style={{ height: 46, paddingHorizontal: 18, borderRadius: 23, backgroundColor: '#F5A524', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                <Icon name="chatbubble" size={18} color="#16160F" /><Txt v="smallStrong" style={{ color: '#16160F' }}>Escribir</Txt>
              </Pressy>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
