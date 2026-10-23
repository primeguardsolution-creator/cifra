import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Txt } from './Txt';
import { tr } from '../i18n';
import { IconButton } from './Button';
import { Icon, IconName } from './Icon';
import { Pressy } from './Pressy';

type Props = { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; scroll?: boolean; maxHeight?: number };

/** Bottom sheet on phones, centered dialog on large screens. */
export function Sheet({ visible, onClose, title, children, scroll = true, maxHeight }: Props) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  const [mounted, setMounted] = useState(visible);
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) { setMounted(true); Animated.timing(t, { toValue: 1, duration: 240, useNativeDriver: Platform.OS !== 'web' }).start(); }
    else Animated.timing(t, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => finished && setMounted(false));
  }, [visible, t]);

  if (!mounted) return null;
  const limit = maxHeight ?? height * 0.88;
  const body = scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>{children}</ScrollView> : <View style={{ paddingBottom: 24 }}>{children}</View>;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Animated.View style={{ position: 'absolute', inset: 0, backgroundColor: c.overlay, opacity: t } as object}>
          <Pressable accessibilityLabel={tr('Cerrar')} style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={{
            width: '100%', maxWidth: wide ? 520 : undefined, maxHeight: limit, backgroundColor: c.surface,
            borderTopLeftRadius: 26, borderTopRightRadius: 26, borderBottomLeftRadius: wide ? 26 : 0, borderBottomRightRadius: wide ? 26 : 0,
            paddingTop: 10, paddingHorizontal: 20, opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [wide ? 12 : Dimensions.get('window').height * 0.4, 0] }) }],
            shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 40, shadowOffset: { width: 0, height: -8 },
          }}
        >
          {!wide && <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 10 }} />}
          {title && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, minHeight: 40 }}>
              <Txt v="h2">{title}</Txt>
              <IconButton icon="close" label="Cerrar" onPress={onClose} tone="muted" size={36} />
            </View>
          )}
          {body}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetRow({ icon, label, onPress, tone = 'text', right, sub }: { icon?: IconName; label: string; onPress?: () => void; tone?: 'text' | 'danger' | 'accent'; right?: React.ReactNode; sub?: string }) {
  const { c } = useTheme();
  return (
    <Pressy onPress={onPress} scale={0.985} hoverStyle={{ backgroundColor: c.surfaceAlt }} accessibilityRole="button" accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 6, borderRadius: 14 }}>
      {icon && <Icon name={icon} size={22} tone={tone} />}
      <View style={{ flex: 1 }}>
        <Txt v="bodyStrong" tone={tone}>{label}</Txt>
        {sub && <Txt v="small" tone="muted">{sub}</Txt>}
      </View>
      {right}
    </Pressy>
  );
}
