import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';
import { BusinessMembership, myBusinesses } from '../lib/api';
import { useTheme } from '../theme/ThemeProvider';
import { Space, legacyBizAccent } from '../theme/tokens';
import { markSpaceSwitch } from '../lib/motion';
import { SpaceTransition } from '../components/SpaceTransition';
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
  const { space, setSpace, setBizAccent } = useTheme();
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
  // The Business space wears the colour of the active business, so switching businesses switches the whole workspace look.
  useEffect(() => { if (active) setBizAccent(legacyBizAccent(active.business.accent)); }, [active?.business.id, active?.business.accent, setBizAccent]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchSpace = useCallback((next?: Space) => {
    const target: Space = next ?? (space === 'personal' ? 'business' : 'personal');
    if (target === space) return;
    const native = Platform.OS !== 'web';
    setOverlay(target);
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: native }).start(() => {
      markSpaceSwitch(target);
      setSpace(target);
      router.replace(target === 'business' ? '/inbox' : '/chats');
      setTimeout(() => Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: native }).start(() => setOverlay(null)), 750);
    });
  }, [space, fade, setSpace]);

  const value = useMemo(() => ({ space, businesses, loaded, active, setActiveBusiness, switchSpace, refreshBusinesses }), [space, businesses, loaded, active, setActiveBusiness, switchSpace, refreshBusinesses]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {overlay && <SpaceTransition to={overlay} opacity={fade} />}
    </Ctx.Provider>
  );
}

export function useSpace(): SpaceState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSpace must be used inside SpaceProvider.');
  return v;
}
