import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import { BusinessMembership, myBusinesses } from '../lib/api';
import { useTheme } from '../theme/ThemeProvider';
import { Space } from '../theme/tokens';
import { Icon, Txt } from '../ui';
import { useAuth } from './AuthProvider';

type SpaceState = {
  space: Space;
  businesses: BusinessMembership[];
  loaded: boolean;
  active: BusinessMembership | null;
  setActiveBusiness: (id: string) => void;
  switchSpace: (next?: Space) => void;
  refreshBusinesses: () => Promise<void>;
};

const Ctx = createContext<SpaceState | null>(null);
const ACTIVE_KEY = 'cifra.activeBusiness';

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { space, setSpace, c } = useTheme();
  const [businesses, setBusinesses] = useState<BusinessMembership[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Space | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  const refreshBusinesses = useCallback(async () => {
    try { setBusinesses(await myBusinesses()); } catch { /* offline: keep previous */ } finally { setLoaded(true); }
  }, []);

  useEffect(() => { AsyncStorage.getItem(ACTIVE_KEY).then((v) => v && setActiveId(v)).catch(() => {}); }, []);
  useEffect(() => { if (user) refreshBusinesses(); else { setBusinesses([]); setLoaded(false); } }, [user, refreshBusinesses]);

  const active = useMemo(() => businesses.find((b) => b.business.id === activeId) ?? businesses[0] ?? null, [businesses, activeId]);
  const setActiveBusiness = useCallback((id: string) => { setActiveId(id); AsyncStorage.setItem(ACTIVE_KEY, id).catch(() => {}); }, []);

  const switchSpace = useCallback((next?: Space) => {
    const target: Space = next ?? (space === 'personal' ? 'business' : 'personal');
    if (target === space) return;
    const native = Platform.OS !== 'web';
    setOverlay(target);
    Animated.timing(fade, { toValue: 1, duration: 170, useNativeDriver: native }).start(() => {
      setSpace(target);
      router.replace(target === 'business' ? '/inbox' : '/chats');
      setTimeout(() => Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: native }).start(() => setOverlay(null)), 220);
    });
  }, [space, fade, setSpace]);

  const value = useMemo(() => ({ space, businesses, loaded, active, setActiveBusiness, switchSpace, refreshBusinesses }), [space, businesses, loaded, active, setActiveBusiness, switchSpace, refreshBusinesses]);

  const to = overlay === 'business';
  return (
    <Ctx.Provider value={value}>
      {children}
      {overlay && (
        <Animated.View pointerEvents="auto" style={{ position: 'absolute', inset: 0, opacity: fade, backgroundColor: to ? '#000000' : '#1B1440', alignItems: 'center', justifyContent: 'center', zIndex: 2000 } as object}>
          <View style={{ alignItems: 'center', gap: 14 }}>
            <View style={{ width: 72, height: 72, borderRadius: to ? 10 : 28, backgroundColor: to ? '#F5A524' : '#9B86FF', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={to ? 'storefront' : 'person'} size={34} color={to ? '#1A1100' : '#0E0630'} />
            </View>
            <Txt v="h2" style={{ color: '#fff' }}>{to ? 'Espacio Business' : 'Espacio Personal'}</Txt>
            <Txt v="small" style={{ color: 'rgba(255,255,255,0.6)' }}>{to ? 'Bandeja, agenda, clientes y Doer' : 'Tus conversaciones privadas'}</Txt>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export function useSpace(): SpaceState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSpace must be used inside SpaceProvider.');
  return v;
}
