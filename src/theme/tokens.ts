export type Mode = 'light' | 'dark';
export type Space = 'personal' | 'business';

export type Palette = {
  bg: string; surface: string; surfaceAlt: string; sunken: string; border: string; borderStrong: string;
  text: string; textMuted: string; textFaint: string;
  accent: string; accentText: string; accentSoft: string; accentSoftText: string; highlight: string;
  /** Text/icon colour that reads on top of `highlight` (ink on amber, white on cobalt…). */
  highlightText: string;
  bubbleOut: string; bubbleOutText: string; bubbleOutMeta: string; bubbleIn: string; bubbleInText: string;
  danger: string; dangerSoft: string; success: string; warning: string; warningSoft: string;
  overlay: string; glass: string; glassBorder: string; rail: string; railText: string;
  internal: string; internalBorder: string;
};

// Personal = "Aurora": cool paper / true black, electric-violet identity, gradient bubbles, soft squircles.
const personalLight: Palette = {
  bg: '#F6F6FB', surface: '#FFFFFF', surfaceAlt: '#EFEFF7', sunken: '#E8E8F2', border: '#E2E2EE', borderStrong: '#CBCBDD',
  text: '#14122B', textMuted: '#625F7E', textFaint: '#9795AE',
  accent: '#5B3FD6', accentText: '#FFFFFF', accentSoft: '#E9E4FD', accentSoftText: '#4529B8', highlight: '#18B5C8', highlightText: '#FFFFFF',
  bubbleOut: '#5B3FD6', bubbleOutText: '#FFFFFF', bubbleOutMeta: 'rgba(255,255,255,0.7)', bubbleIn: '#FFFFFF', bubbleInText: '#14122B',
  danger: '#D6455D', dangerSoft: '#FCE4E8', success: '#12A878', warning: '#C98A12', warningSoft: '#F8EDD2',
  overlay: 'rgba(10,8,30,0.5)', glass: 'rgba(255,255,255,0.8)', glassBorder: 'rgba(255,255,255,0.7)', rail: '#1B1440', railText: '#BDB4EA',
  internal: '#FFF4D6', internalBorder: '#E9CF86',
};

const personalDark: Palette = {
  bg: '#000000', surface: '#0B0B10', surfaceAlt: '#12121A', sunken: '#06060A', border: '#1B1B26', borderStrong: '#2A2A3A',
  text: '#F2F1FC', textMuted: '#9A98B4', textFaint: '#61607A',
  accent: '#9B86FF', accentText: '#0E0630', accentSoft: '#17122E', accentSoftText: '#C4B8FF', highlight: '#3DD6E8', highlightText: '#06262B',
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
  accent: '#16160F', accentText: '#FFD98A', accentSoft: '#FCEFCB', accentSoftText: '#6B4600', highlight: '#E8890C', highlightText: '#16160F',
  bubbleOut: '#16160F', bubbleOutText: '#FFF3D6', bubbleOutMeta: 'rgba(255,243,214,0.62)', bubbleIn: '#FFFFFF',
  rail: '#16160F', railText: '#CDBF98', glass: 'rgba(255,255,255,0.9)',
};

const businessDark: Palette = {
  ...personalDark,
  bg: '#000000', surface: '#0A0A08', surfaceAlt: '#12120E', sunken: '#050504', border: '#1F1F18', borderStrong: '#34342A',
  accent: '#F5A524', accentText: '#1A1100', accentSoft: '#241A06', accentSoftText: '#FFCB6B', highlight: '#FFB84D', highlightText: '#16160F',
  bubbleOut: '#3D2E0B', bubbleOutText: '#FFF3D6', bubbleOutMeta: 'rgba(255,243,214,0.6)', bubbleIn: '#12120E',
  rail: '#000000', railText: '#9B8E68', glass: 'rgba(10,10,8,0.9)',
};

export const palettes: Record<Space, Record<Mode, Palette>> = {
  personal: { light: personalLight, dark: personalDark },
  business: { light: businessLight, dark: businessDark },
};

/** Incognito rooms: strict black & white. Only photos and videos keep their colour. */
const incognitoDark: Palette = {
  bg: '#000000', surface: '#0A0A0A', surfaceAlt: '#141414', sunken: '#050505', border: '#242424', borderStrong: '#3C3C3C',
  text: '#F2F2F2', textMuted: '#A3A3A3', textFaint: '#6A6A6A',
  accent: '#F2F2F2', accentText: '#000000', accentSoft: '#1C1C1C', accentSoftText: '#E6E6E6', highlight: '#FFFFFF', highlightText: '#000000',
  bubbleOut: '#E6E6E6', bubbleOutText: '#000000', bubbleOutMeta: 'rgba(0,0,0,0.55)', bubbleIn: '#171717', bubbleInText: '#F2F2F2',
  danger: '#F2F2F2', dangerSoft: '#2A2A2A', success: '#DADADA', warning: '#CFCFCF', warningSoft: '#262626',
  overlay: 'rgba(0,0,0,0.82)', glass: 'rgba(10,10,10,0.92)', glassBorder: 'rgba(255,255,255,0.1)', rail: '#000000', railText: '#8A8A8A',
  internal: '#1C1C1C', internalBorder: '#4A4A4A',
};
const incognitoLight: Palette = {
  bg: '#FFFFFF', surface: '#F7F7F7', surfaceAlt: '#EDEDED', sunken: '#E6E6E6', border: '#D9D9D9', borderStrong: '#B8B8B8',
  text: '#0A0A0A', textMuted: '#5C5C5C', textFaint: '#969696',
  accent: '#0A0A0A', accentText: '#FFFFFF', accentSoft: '#E8E8E8', accentSoftText: '#1A1A1A', highlight: '#000000', highlightText: '#FFFFFF',
  bubbleOut: '#111111', bubbleOutText: '#FFFFFF', bubbleOutMeta: 'rgba(255,255,255,0.65)', bubbleIn: '#F0F0F0', bubbleInText: '#0A0A0A',
  danger: '#0A0A0A', dangerSoft: '#E3E3E3', success: '#2B2B2B', warning: '#3A3A3A', warningSoft: '#E6E6E6',
  overlay: 'rgba(0,0,0,0.5)', glass: 'rgba(255,255,255,0.9)', glassBorder: 'rgba(0,0,0,0.08)', rail: '#111111', railText: '#9A9A9A',
  internal: '#EFEFEF', internalBorder: '#B0B0B0',
};
export const incognitoPalettes: Record<Mode, Palette> = { light: incognitoLight, dark: incognitoDark };

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'GeistMono_500Medium',
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  /** Typewriter face used everywhere inside an incognito room, so it is unmistakable. */
  typewriter: 'SpecialElite_400Regular',
};

/** One colour per business, so each workspace is told apart at a glance. Amber is the Ink & Amber default. */
export type BizAccentKey = 'amber' | 'cobalt' | 'jade' | 'ruby' | 'orchid';
export const bizAccentOptions: { key: BizAccentKey; label: string; swatch: string }[] = [
  { key: 'amber', label: 'Ámbar', swatch: '#F5A524' }, { key: 'cobalt', label: 'Cobalto', swatch: '#3B7BFF' }, { key: 'jade', label: 'Jade', swatch: '#1FA67A' },
  { key: 'ruby', label: 'Rubí', swatch: '#E0355B' }, { key: 'orchid', label: 'Orquídea', swatch: '#A855F7' },
];
export const bizAccentPatches: Record<BizAccentKey, Record<Mode, Partial<Palette>>> = {
  amber: { light: {}, dark: {} },
  cobalt: {
    light: { highlight: '#2F6BFF', highlightText: '#FFFFFF', accentText: '#CFE0FF', accentSoft: '#DCE7FF', accentSoftText: '#1E3F99', bubbleOutText: '#EAF1FF', bubbleOutMeta: 'rgba(234,241,255,0.62)', railText: '#9FB5E0' },
    dark: { accent: '#5B8DFF', accentText: '#061233', accentSoft: '#0E1A33', accentSoftText: '#9DBBFF', highlight: '#6E9BFF', highlightText: '#061233', bubbleOut: '#13306B', bubbleOutText: '#EAF1FF', bubbleOutMeta: 'rgba(234,241,255,0.6)', railText: '#7F93BF' },
  },
  jade: {
    light: { highlight: '#1FA67A', highlightText: '#FFFFFF', accentText: '#CDEFE2', accentSoft: '#D9F2E8', accentSoftText: '#0E5A42', bubbleOutText: '#EAF8F2', bubbleOutMeta: 'rgba(234,248,242,0.62)', railText: '#9CC9B8' },
    dark: { accent: '#2FC48F', accentText: '#04170F', accentSoft: '#0B2219', accentSoftText: '#7FE6BE', highlight: '#46D6A0', highlightText: '#04170F', bubbleOut: '#124A37', bubbleOutText: '#EAF8F2', bubbleOutMeta: 'rgba(234,248,242,0.6)', railText: '#7FA393' },
  },
  ruby: {
    light: { highlight: '#E0355B', highlightText: '#FFFFFF', accentText: '#FFD3DC', accentSoft: '#FCE0E6', accentSoftText: '#8E1B36', bubbleOutText: '#FFF0F3', bubbleOutMeta: 'rgba(255,240,243,0.62)', railText: '#D9A3B0' },
    dark: { accent: '#FF5C7F', accentText: '#2A0710', accentSoft: '#2B1017', accentSoftText: '#FFA3B7', highlight: '#FF7390', highlightText: '#2A0710', bubbleOut: '#6B1A2E', bubbleOutText: '#FFF0F3', bubbleOutMeta: 'rgba(255,240,243,0.6)', railText: '#BF8392' },
  },
  orchid: {
    light: { highlight: '#9333EA', highlightText: '#FFFFFF', accentText: '#E9D5FF', accentSoft: '#EDE3FB', accentSoftText: '#5B21B6', bubbleOutText: '#F6EEFF', bubbleOutMeta: 'rgba(246,238,255,0.62)', railText: '#BBA3DE' },
    dark: { accent: '#B06CFF', accentText: '#1A0633', accentSoft: '#1E1230', accentSoftText: '#D1A8FF', highlight: '#C084FC', highlightText: '#1A0633', bubbleOut: '#45206B', bubbleOutText: '#F6EEFF', bubbleOutMeta: 'rgba(246,238,255,0.6)', railText: '#9B86B8' },
  },
};
export const legacyBizAccent = (a: string | null | undefined): BizAccentKey => (a && a in bizAccentPatches ? (a as BizAccentKey) : 'amber');

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
