import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Txt } from './Txt';

type Kind = 'info' | 'success' | 'error';
type Ctx = { show: (message: string, kind?: Kind) => void };
const ToastCtx = createContext<Ctx>({ show: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; kind: Kind; id: number } | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((message: string, kind: Kind = 'info') => {
    clearTimeout(timer.current);
    setToast({ message, kind, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    Animated.spring(v, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 18 }).start();
    timer.current = setTimeout(() => Animated.timing(v, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => setToast(null)), 3200);
    return () => clearTimeout(timer.current);
  }, [toast, v]);

  const value = useMemo(() => ({ show }), [show]);
  const icon = toast?.kind === 'success' ? 'checkmark-circle' : toast?.kind === 'error' ? 'alert-circle' : 'information-circle';
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, alignItems: 'center', opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }], zIndex: 1000 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, maxWidth: 460, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>
            <Icon name={icon} size={20} color={toast.kind === 'error' ? '#FF9C8B' : toast.kind === 'success' ? '#5EE0B0' : c.bg} />
            <Txt v="smallStrong" style={{ color: c.bg, flexShrink: 1 }}>{toast.message}</Txt>
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}
