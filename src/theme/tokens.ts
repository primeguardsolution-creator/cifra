export type Mode = 'light' | 'dark';
export type Space = 'personal' | 'business';

export type Palette = {
  bg: string; surface: string; surfaceAlt: string; sunken: string; border: string; borderStrong: string;
  text: string; textMuted: string; textFaint: string;
  accent: string; accentText: string; accentSoft: string; accentSoftText: string; highlight: string;
  bubbleOut: string; bubbleOutText: string; bubbleOutMeta: string; bubbleIn: string; bubbleInText: string;
  danger: string; dangerSoft: string; success: string; warning: string; warningSoft: string;
  overlay: string; glass: string; glassBorder: string; rail: string; railText: string;
  internal: string; internalBorder: string;
};

// Personal = "Aurora": cool paper / true black, electric-violet identity, gradient bubbles, soft squircles.
const personalLight: Palette = {
  bg: '#F6F6FB', surface: '#FFFFFF', surfaceAlt: '#EFEFF7', sunken: '#E8E8F2', border: '#E2E2EE', borderStrong: '#CBCBDD',
  text: '#14122B', textMuted: '#625F7E', textFaint: '#9795AE',
  accent: '#5B3FD6', accentText: '#FFFFFF', accentSoft: '#E9E4FD', accentSoftText: '#4529B8', highlight: '#18B5C8',
  bubbleOut: '#5B3FD6', bubbleOutText: '#FFFFFF', bubbleOutMeta: 'rgba(255,255,255,0.7)', bubbleIn: '#FFFFFF', bubbleInText: '#14122B',
  danger: '#D6455D', dangerSoft: '#FCE4E8', success: '#12A878', warning: '#C98A12', warningSoft: '#F8EDD2',
  overlay: 'rgba(10,8,30,0.5)', glass: 'rgba(255,255,255,0.8)', glassBorder: 'rgba(255,255,255,0.7)', rail: '#1B1440', railText: '#BDB4EA',
  internal: '#FFF4D6', internalBorder: '#E9CF86',
};

const personalDark: Palette = {
  bg: '#000000', surface: '#0B0B10', surfaceAlt: '#12121A', sunken: '#06060A', border: '#1B1B26', borderStrong: '#2A2A3A',
  text: '#F2F1FC', textMuted: '#9A98B4', textFaint: '#61607A',
  accent: '#9B86FF', accentText: '#0E0630', accentSoft: '#17122E', accentSoftText: '#C4B8FF', highlight: '#3DD6E8',
  bubbleOut: '#5B3FD6', bubbleOutText: '#FFFFFF', bubbleOutMeta: 'rgba(255,255,255,0.66)', bubbleIn: '#14141D', bubbleInText: '#F2F1FC',
  danger: '#FF7A8E', dangerSoft: '#2B1117', success: '#3DDDA8', warning: '#E3B04B', warningSoft: '#261E0C',
  overlay: 'rgba(0,0,0,0.72)', glass: 'rgba(11,11,16,0.82)', glassBorder: 'rgba(255,255,255,0.08)', rail: '#000000', railText: '#8B88AA',
  internal: '#241E0A', internalBorder: '#5B4A1A',
};

// Business = "Ink & Amber": sharp corners, dense, message-row layout (Slack-like), ink sidebar with an amber signal color.
const businessLight: Palette = {
  ...personalLight,
  bg: '#F3F2EC', surface: '#FFFFFF', surfaceAlt: '#EBEAE2', sunken: '#E3E2D8', border: '#DAD8CB', borderStrong: '#BDBAA8',
  text: '#15150F', textMuted: '#5E5D50', textFaint: '#908F7E',
  accent: '#16160F', accentText: '#FFD98A', accentSoft: '#FCEFCB', accentSoftText: '#6B4600', highlight: '#E8890C',
  bubbleOut: '#16160F', bubbleOutText: '#FFF3D6', bubbleOutMeta: 'rgba(255,243,214,0.62)', bubbleIn: '#FFFFFF',
  rail: '#16160F', railText: '#CDBF98', glass: 'rgba(255,255,255,0.9)',
};

const businessDark: Palette = {
  ...personalDark,
  bg: '#000000', surface: '#0A0A08', surfaceAlt: '#12120E', sunken: '#050504', border: '#1F1F18', borderStrong: '#34342A',
  accent: '#F5A524', accentText: '#1A1100', accentSoft: '#241A06', accentSoftText: '#FFCB6B', highlight: '#FFB84D',
  bubbleOut: '#3D2E0B', bubbleOutText: '#FFF3D6', bubbleOutMeta: 'rgba(255,243,214,0.6)', bubbleIn: '#12120E',
  rail: '#000000', railText: '#9B8E68', glass: 'rgba(10,10,8,0.9)',
};

export const palettes: Record<Space, Record<Mode, Palette>> = {
  personal: { light: personalLight, dark: personalDark },
  business: { light: businessLight, dark: businessDark },
};

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'GeistMono_500Medium',
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

/** Avatar tints that stay inside the CIFRA family (greens, sand, clay, slate). */
export const avatarTints: [string, string][] = [
  ['#2E7D61', '#1B5A44'], ['#7A9B8A', '#4F7466'], ['#B8892D', '#8A6417'], ['#A25B49', '#7A3D2E'],
  ['#4E6A8A', '#34506E'], ['#6B6F4E', '#4A4D32'], ['#3E8A8A', '#26615F'], ['#8A5E7A', '#613F54'],
];

export const statusBackgrounds: [string, string][] = [
  ['#0E4B3A', '#1FA67A'], ['#17231F', '#4A3D1C'], ['#7A3D2E', '#D08A5B'], ['#34506E', '#7AA0C8'], ['#4A3A6B', '#9B7FD0'], ['#8A6417', '#E3B85C'],
];

export type AccentKey = 'emerald' | 'ocean' | 'violet' | 'sunset' | 'rose';
export const accentOptions: { key: AccentKey; label: string; swatch: string }[] = [
  { key: 'violet', label: 'Ultravioleta', swatch: '#5B3FD6' }, { key: 'ocean', label: 'Océano', swatch: '#0B5A8A' }, { key: 'emerald', label: 'Esmeralda', swatch: '#0E4B3A' },
  { key: 'sunset', label: 'Atardecer', swatch: '#B4532A' }, { key: 'rose', label: 'Rosa', swatch: '#B03A68' },
];
/** Overrides applied on top of the Personal palette. Violet ("Ultravioleta") is the CIFRA default. */
export const accentPatches: Record<AccentKey, Record<Mode, Partial<Palette>>> = {
  emerald: {
    light: { accent: '#0E4B3A', accentSoft: '#DDEFE7', accentSoftText: '#0E4B3A', highlight: '#1FA67A', bubbleOut: '#0E4B3A', rail: '#0B2F25', railText: '#BFD6CB' },
    dark: { accent: '#2FB583', accentText: '#04150E', accentSoft: '#0E211A', accentSoftText: '#6FE0B4', highlight: '#46D6A0', bubbleOut: '#15664C', rail: '#000000', railText: '#7F978C' },
  },
  ocean: {
    light: { accent: '#0B5A8A', accentSoft: '#DBEAF4', accentSoftText: '#0B5A8A', highlight: '#2E9BD6', bubbleOut: '#0B5A8A', bubbleOutText: '#F2F9FE', rail: '#0A2C44', railText: '#B7D3E6' },
    dark: { accent: '#4FB3F0', accentText: '#04121C', accentSoft: '#0F2433', accentSoftText: '#8CD0F8', highlight: '#6BC4F5', bubbleOut: '#14618A', rail: '#06131C', railText: '#7FA3BB' },
  },
  violet: { light: {}, dark: {} },
  sunset: {
    light: { accent: '#B4532A', accentSoft: '#F7E3D8', accentSoftText: '#8E3E1C', highlight: '#E57B45', bubbleOut: '#B4532A', bubbleOutText: '#FFF6F0', rail: '#3A1C0F', railText: '#E8C7B3' },
    dark: { accent: '#F0905A', accentText: '#2A1204', accentSoft: '#2C1B12', accentSoftText: '#F7B994', highlight: '#F5A472', bubbleOut: '#8E4524', rail: '#1B0D06', railText: '#B58D75' },
  },
  rose: {
    light: { accent: '#B03A68', accentSoft: '#F7DFE9', accentSoftText: '#8E2850', highlight: '#E0689A', bubbleOut: '#B03A68', bubbleOutText: '#FFF5F9', rail: '#3A1226', railText: '#EBC0D2' },
    dark: { accent: '#F07DAA', accentText: '#2A0716', accentSoft: '#2D1520', accentSoftText: '#F7A9C8', highlight: '#F593BA', bubbleOut: '#8E2F54', rail: '#1B0812', railText: '#B58397' },
  },
};

export type WallpaperKey = 'cifra' | 'aurora' | 'trama' | 'noche' | 'plain' | 'image';
/** Four CIFRA originals, a plain one, and the user's own picture. */
export const wallpaperOptions: { key: WallpaperKey; label: string }[] = [
  { key: 'cifra', label: 'Cifra' }, { key: 'aurora', label: 'Aurora' }, { key: 'trama', label: 'Trama' }, { key: 'noche', label: 'Noche' }, { key: 'plain', label: 'Liso' },
];
export const legacyWallpaper = (w: string | null | undefined): WallpaperKey => (w && ['cifra', 'aurora', 'trama', 'noche', 'plain', 'image'].includes(w) ? (w as WallpaperKey) : 'cifra');
