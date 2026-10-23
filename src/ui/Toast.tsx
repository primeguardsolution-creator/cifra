import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Txt } from './Txt';

type Kind = 'info' | 'success' | 'error' | 'message';
type Opts = { title?: string; onPress?: () => void; duration?: number; /** Small photo of whoever wrote (replaces the icon). */ avatar?: { name?: string | null; seed?: string; path?: string | null; business?: boolean } };
type Ctx = { show: (message: string, kind?: Kind, opts?: Opts) => void };
const ToastCtx = createContext<Ctx>({ show: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; kind: Kind; id: number; opts?: Opts } | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((message: string, kind: Kind = 'info', opts?: Opts) => {
    clearTimeout(timer.current);
    setToast({ message, kind, id: Date.now(), opts });
  }, []);
  const hide = useCallback(() => { clearTimeout(timer.current); Animated.timing(v, { toValue: 0, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start(() => setToast(null)); }, [v]);

  useEffect(() => {
    if (!toast) return;
    Animated.spring(v, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 18 }).start();
    timer.current = setTimeout(() => Animated.timing(v, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => setToast(null)), toast.opts?.duration ?? 3200);
    return () => clearTimeout(timer.current);
  }, [toast, v]);

  const value = useMemo(() => ({ show }), [show]);
  const icon = toast?.kind === 'success' ? 'checkmark-circle' : toast?.kind === 'error' ? 'alert-circle' : toast?.kind === 'message' ? 'chatbubble-ellipses' : 'information-circle';
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {toast && (
        <Animated.View pointerEvents={toast.opts?.onPress ? 'box-none' : 'none'} accessibilityLiveRegion="polite" style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, alignItems: 'center', opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }], zIndex: 1000 }}>
          <Pressable disabled={!toast.opts?.onPress} onPress={() => { const fn = toast.opts?.onPress; hide(); fn?.(); }} accessibilityRole={toast.opts?.onPress ? 'button' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: toast.kind === 'message' ? '#1FA67A' : c.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, maxWidth: 460, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>
            {toast.opts?.avatar ? <Avatar name={toast.opts.avatar.name} seed={toast.opts.avatar.seed} path={toast.opts.avatar.path} business={toast.opts.avatar.business} size={38} /> : <Icon name={icon} size={20} color={toast.kind === 'error' ? '#FF9C8B' : toast.kind === 'success' ? '#5EE0B0' : toast.kind === 'message' ? '#fff' : c.bg} />}
            <View style={{ flexShrink: 1 }}>
              {toast.opts?.title ? <Txt v="caption" style={{ color: toast.kind === 'message' ? 'rgba(255,255,255,0.85)' : c.bg, opacity: 0.85 }} numberOfLines={1}>{toast.opts.title}</Txt> : null}
              <Txt v="smallStrong" style={{ color: toast.kind === 'message' ? '#fff' : c.bg }} numberOfLines={2}>{toast.message}</Txt>
            </View>
          </Pressable>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}
