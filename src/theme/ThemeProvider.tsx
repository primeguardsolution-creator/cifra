import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { AccentKey, BizAccentKey, Mode, Palette, Space, WallpaperKey, accentPatches, bizAccentPatches, incognitoPalettes, legacyBizAccent, legacyWallpaper, palettes } from './tokens';

export type ModePreference = 'auto' | Mode;

type ThemeState = {
  c: Palette;
  mode: Mode;
  space: Space;
  preference: ModePreference;
  setPreference: (p: ModePreference) => void;
  setSpace: (s: Space) => void;
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
  /** Colour of the active business (Business space only). Follows `businesses.accent`; SpaceProvider keeps it in sync. */
  bizAccent: BizAccentKey;
  setBizAccent: (a: BizAccentKey) => void;
  /** Corner radius for the current space: soft in Personal, sharp in Business. */
  r: (n: number) => number;
  wallpaper: WallpaperKey;
  setWallpaper: (w: WallpaperKey) => void;
  /** The user's own chat background (data URL on web), used when wallpaper === 'image'. */
  wallpaperImage: string | null;
  setWallpaperImage: (uri: string | null) => void;
  /** True inside an incognito room: black & white palette and typewriter type for every text. */
  incognito: boolean;
};

const Ctx = createContext<ThemeState | null>(null);
const PREF_KEY = 'cifra.theme';
const SPACE_KEY = 'cifra.space';
const ACCENT_KEY = 'cifra.accent';
const BIZ_ACCENT_KEY = 'cifra.bizAccent';
const WALL_KEY = 'cifra.wallpaper';
const WALL_IMG_KEY = 'cifra.wallpaper.image';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ModePreference>('auto');
  const [space, setSpaceState] = useState<Space>('personal');
  const [accent, setAccentState] = useState<AccentKey>('violet');
  const [bizAccent, setBizAccentState] = useState<BizAccentKey>('amber');
  const [wallpaper, setWallpaperState] = useState<WallpaperKey>('cifra')
  const [wallpaperImage, setWallpaperImageState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.multiGet([PREF_KEY, SPACE_KEY, ACCENT_KEY, WALL_KEY, WALL_IMG_KEY, BIZ_ACCENT_KEY]).then(([[, p], [, s], [, a], [, w], [, img], [, ba]]) => {
      if (a && a in accentPatches) setAccentState(a as AccentKey);
      if (ba) setBizAccentState(legacyBizAccent(ba));
      if (w) setWallpaperState(legacyWallpaper(w));
      if (img) setWallpaperImageState(img);
      if (p === 'light' || p === 'dark' || p === 'auto') setPreferenceState(p);
      if (s === 'personal' || s === 'business') setSpaceState(s);
    }).catch(() => {});
  }, []);

  const setPreference = useCallback((p: ModePreference) => { setPreferenceState(p); AsyncStorage.setItem(PREF_KEY, p).catch(() => {}); }, []);
  const setSpace = useCallback((s: Space) => { setSpaceState(s); AsyncStorage.setItem(SPACE_KEY, s).catch(() => {}); }, []);

  const setAccent = useCallback((a: AccentKey) => { setAccentState(a); AsyncStorage.setItem(ACCENT_KEY, a).catch(() => {}); }, []);
  const setBizAccent = useCallback((a: BizAccentKey) => { setBizAccentState((cur) => (cur === a ? cur : a)); AsyncStorage.setItem(BIZ_ACCENT_KEY, a).catch(() => {}); }, []);
  const setWallpaper = useCallback((w: WallpaperKey) => { setWallpaperState(w); AsyncStorage.setItem(WALL_KEY, w).catch(() => {}); }, []);
  const setWallpaperImage = useCallback((uri: string | null) => { setWallpaperImageState(uri); (uri ? AsyncStorage.setItem(WALL_IMG_KEY, uri) : AsyncStorage.removeItem(WALL_IMG_KEY)).catch(() => {}); }, []);

  const mode: Mode = preference === 'auto' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const c = useMemo<Palette>(() => (space === 'personal' ? { ...palettes.personal[mode], ...accentPatches[accent][mode] } : { ...palettes.business[mode], ...bizAccentPatches[bizAccent][mode] }), [space, mode, accent, bizAccent]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = c.bg;
    document.documentElement.style.colorScheme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg);
  }, [c.bg, mode]);

  const r = useCallback((n: number) => (space === 'business' ? Math.max(3, Math.round(n * 0.3)) : n), [space]);
  const value = useMemo(() => ({ c, mode, space, r, preference, setPreference, setSpace, accent, setAccent, bizAccent, setBizAccent, wallpaper, setWallpaper, wallpaperImage, setWallpaperImage, incognito: false }), [c, mode, space, r, preference, setPreference, setSpace, accent, setAccent, bizAccent, setBizAccent, wallpaper, setWallpaper, wallpaperImage, setWallpaperImage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Wraps a subtree (an incognito room) in the black & white theme; everything below reads it through `useTheme()`. */
export function IncognitoTheme({ children }: { children: React.ReactNode }) {
  const parent = useTheme();
  const value = useMemo<ThemeState>(() => ({ ...parent, c: incognitoPalettes[parent.mode], incognito: true, r: (n: number) => Math.max(2, Math.round(n * 0.2)) }), [parent]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider.');
  return v;
}
