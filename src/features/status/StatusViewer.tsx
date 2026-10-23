import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusRow } from '../../lib/api';
import { relative } from '../../lib/format';
import { signedMediaUrl } from '../../lib/media';
import { statusBackgrounds } from '../../theme/tokens';
import { Avatar, IconButton, Pressy, Txt } from '../../ui';

type Props = { visible: boolean; items: StatusRow[]; name: string; avatarPath?: string | null; seed: string; mine?: boolean; onClose: () => void; onDelete?: (s: StatusRow) => void };
const DURATION = 5500;

export function StatusViewer({ visible, items, name, avatarPath, seed, mine, onClose, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const current = items[index];

  useEffect(() => { if (visible) setIndex(0); }, [visible]);

  const next = useCallback(() => setIndex((i) => { if (i + 1 >= items.length) { onClose(); return i; } return i + 1; }), [items.length, onClose]);
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    if (!visible || !current) return;
    setPhoto(null);
    let live = true;
    if (current.media_path) signedMediaUrl(current.media_path).then((u) => live && setPhoto(u));
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: DURATION, useNativeDriver: false });
    anim.start(({ finished }) => finished && next());
    return () => { live = false; anim.stop(); };
  }, [visible, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !current) return null;
  const [from, to] = statusBackgrounds[current.bg % statusBackgrounds.length];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 520 }}>
          {current.kind === 'text'
            ? <LinearGradient colors={[from, to]} style={{ position: 'absolute', inset: 0 } as object} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            : photo ? <Image source={{ uri: photo }} resizeMode="contain" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' } as object} /> : null}
          {current.kind === 'text' && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 }}><Txt style={{ color: '#fff', fontSize: 30, lineHeight: 38, textAlign: 'center', fontFamily: 'Inter_700Bold' }}>{current.body}</Txt></View>}
          {current.kind === 'image' && current.body ? <View style={{ position: 'absolute', bottom: insets.bottom + 40, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(0,0,0,0.45)' }}><Txt style={{ color: '#fff', textAlign: 'center' }}>{current.body}</Txt></View> : null}

          <View style={{ position: 'absolute', inset: 0, flexDirection: 'row' } as object}>
            <Pressy onPress={prev} style={{ flex: 1 }} scale={1} accessibilityLabel="Anterior"><View style={{ flex: 1 }} /></Pressy>
            <Pressy onPress={next} style={{ flex: 2 }} scale={1} accessibilityLabel="Siguiente"><View style={{ flex: 1 }} /></Pressy>
          </View>

          <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 12, gap: 10 }} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {items.map((s, i) => (
                <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
                  <Animated.View style={{ height: 3, backgroundColor: '#fff', width: i < index ? '100%' : i === index ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={name} seed={seed} path={avatarPath} size={38} />
              <View style={{ flex: 1 }}><Txt v="smallStrong" style={{ color: '#fff' }}>{mine ? 'Mi estado' : name}</Txt><Txt v="caption" style={{ color: 'rgba(255,255,255,0.75)' }}>{relative(current.created_at)}</Txt></View>
              {mine && onDelete && <IconButton icon="trash" label="Eliminar estado" size={40} onPress={() => { onDelete(current); if (items.length === 1) onClose(); }} />}
              <IconButton icon="close" label="Cerrar" size={40} onPress={onClose} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
