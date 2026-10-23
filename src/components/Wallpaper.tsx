import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { WallpaperKey } from '../theme/tokens';

// ── CIFRA's own chat backgrounds ─────────────────────────────────────────────────────────────────────────────
// Web renders them with CSS + inline SVG tiles (crisp at any size, no image assets). Native falls back to the gradient.

const doodles = {
  bubble: '<path d="M4 6h20a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H14l-6 5v-5H4a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z"/>',
  lock: '<rect x="5" y="12" width="16" height="12" rx="3"/><path d="M8 12V9a5 5 0 0 1 10 0v3"/><circle cx="13" cy="18" r="1.6"/>',
  key: '<circle cx="8" cy="10" r="5"/><path d="M12 13l12 10M19 20l3-3M22 23l3-3"/>',
  sparkle: '<path d="M13 2l2.5 8.5L24 13l-8.5 2.5L13 24l-2.5-8.5L2 13l8.5-2.5z"/>',
  plane: '<path d="M2 12L26 2 18 26l-4-9z"/><path d="M14 17l12-15"/>',
  heart: '<path d="M13 23S3 16 3 9.5A5.5 5.5 0 0 1 13 7a5.5 5.5 0 0 1 10 2.5C23 16 13 23 13 23z"/>',
  dots: '<circle cx="5" cy="14" r="2.2"/><circle cx="14" cy="14" r="2.2"/><circle cx="23" cy="14" r="2.2"/>',
  wave: '<path d="M2 14h3M7 9v10M12 4v20M17 9v10M22 11v6M26 14h-1"/>',
  phone: '<path d="M6 4h5l2 6-3 2a14 14 0 0 0 6 6l2-3 6 2v5a3 3 0 0 1-3 3C11 25 3 15 3 7a3 3 0 0 1 3-3z"/>',
  cipher: '<path d="M3 6h6M3 12h6M3 18h6M13 6l4 6-4 6M21 6v12"/>',
};

function svgUri(inner: string, w: number, h: number) {
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`)}")`;
}

/** 3×3 staggered grid of rotated line icons: the "cipher doodle" tile. */
function doodleTile(color: string, opacity: number) {
  const order: (keyof typeof doodles)[] = ['bubble', 'key', 'sparkle', 'lock', 'cipher', 'plane', 'heart', 'wave', 'dots', 'phone', 'sparkle', 'bubble'];
  const cells: string[] = [];
  const size = 260;
  const step = size / 3;
  let n = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const name = order[n % order.length];
      const x = col * step + (row % 2 ? step * 0.5 : 0) + 14;
      const y = row * step + 12;
      const rot = [-18, 12, -8, 20, -24, 8, 16, -12, 6][n % 9];
      cells.push(`<g transform="translate(${x % size} ${y}) rotate(${rot} 14 14) scale(1.15)">${doodles[name]}</g>`);
      n++;
    }
  }
  return svgUri(`<g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${cells.join('')}</g>`, size, size);
}

function trameTile(color: string, opacity: number) {
  // Interlocking diamonds with a dot at every crossing.
  const s = 56;
  return svgUri(`<g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1"><path d="M${s / 2} 0L${s} ${s / 2}L${s / 2} ${s}L0 ${s / 2}Z"/><path d="M0 0L${s} ${s}M${s} 0L0 ${s}" stroke-opacity="${opacity * 0.5}"/></g><circle cx="${s / 2}" cy="${s / 2}" r="1.8" fill="${color}" fill-opacity="${opacity * 1.6}"/>`, s, s);
}

function starsTile(color: string, opacity: number) {
  const pts: [number, number, number][] = [[18, 22, 1.4], [62, 70, 1], [104, 30, 1.8], [150, 96, 1], [196, 40, 1.3], [240, 110, 1.6], [34, 140, 1.1], [88, 176, 1.7], [140, 160, 1], [190, 204, 1.4], [250, 180, 1], [60, 250, 1.3], [122, 238, 1.1], [220, 262, 1.8], [282, 36, 1.1], [290, 230, 1.4], [8, 290, 1]];
  const crosses = [[75, 120], [226, 150], [160, 270]];
  return svgUri(`${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="${opacity}"/>`).join('')}${crosses.map(([x, y]) => `<path d="M${x - 5} ${y}h10M${x} ${y - 5}v10" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.2" stroke-linecap="round"/>`).join('')}`, 300, 300);
}

/** Chat background. It must never fight with the bubbles. */
export function Wallpaper({ kind, small }: { kind?: WallpaperKey; small?: boolean }) {
  const { c, mode, space, wallpaper, wallpaperImage, incognito } = useTheme();
  const k: WallpaperKey = kind ?? (space === 'business' || incognito ? 'plain' : wallpaper);
  const dark = mode === 'dark';
  const web = Platform.OS === 'web';

  const style = useMemo(() => {
    if (!web) return null;
    const ink = dark ? '#FFFFFF' : c.accent;
    const scale = small ? 0.38 : 1;
    switch (k) {
      case 'cifra':
        return {
          backgroundColor: dark ? '#030307' : '#F1EFFA',
          backgroundImage: `${doodleTile(ink, dark ? 0.11 : 0.13)}, radial-gradient(120% 70% at 50% -10%, ${dark ? 'rgba(110,80,255,0.22)' : 'rgba(110,80,255,0.16)'}, transparent 60%), radial-gradient(90% 60% at 100% 100%, ${dark ? 'rgba(24,181,200,0.12)' : 'rgba(24,181,200,0.12)'}, transparent 60%)`,
          backgroundSize: `${260 * scale}px ${260 * scale}px, 100% 100%, 100% 100%`,
        };
      case 'aurora':
        return {
          backgroundColor: dark ? '#02020A' : '#F4F1FF',
          backgroundImage: dark
            ? 'radial-gradient(60% 50% at 15% 10%, rgba(120,80,255,0.55), transparent 70%), radial-gradient(55% 45% at 90% 25%, rgba(24,200,220,0.38), transparent 70%), radial-gradient(70% 55% at 50% 105%, rgba(255,70,150,0.32), transparent 70%)'
            : 'radial-gradient(60% 50% at 15% 10%, rgba(140,110,255,0.45), transparent 70%), radial-gradient(55% 45% at 90% 25%, rgba(40,200,220,0.32), transparent 70%), radial-gradient(70% 55% at 50% 105%, rgba(255,110,170,0.30), transparent 70%)',
        };
      case 'trama':
        return { backgroundColor: dark ? '#050508' : '#EEEDF6', backgroundImage: `${trameTile(ink, dark ? 0.1 : 0.14)}, linear-gradient(160deg, ${dark ? 'rgba(91,63,214,0.20)' : 'rgba(91,63,214,0.08)'}, transparent 55%)`, backgroundSize: `${56 * scale}px ${56 * scale}px, 100% 100%` };
      case 'noche':
        return { backgroundColor: dark ? '#000000' : '#E9EEF8', backgroundImage: `${starsTile(dark ? '#FFFFFF' : '#2A3A6B', dark ? 0.55 : 0.3)}, linear-gradient(180deg, ${dark ? '#05061A' : '#DCE5F7'}, ${dark ? '#000000' : '#F1F4FB'})`, backgroundSize: `${300 * scale}px ${300 * scale}px, 100% 100%` };
      default:
        return null;
    }
  }, [k, dark, c.accent, small, web]);

  if (k === 'image' && wallpaperImage) {
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
        <Image source={{ uri: wallpaperImage }} resizeMode="cover" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.22)' }]} />
      </View>
    );
  }
  if (k === 'plain' || k === 'image') return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]} />;
  if (web && style) return <View pointerEvents="none" style={[StyleSheet.absoluteFill, style as object]} />;

  const native: Record<string, [string, string]> = {
    cifra: dark ? ['#030307', '#14102E'] : ['#F1EFFA', '#E6E0FB'],
    aurora: dark ? ['#02020A', '#2A1A66'] : ['#F4F1FF', '#D9D0FF'],
    trama: dark ? ['#050508', '#1A1636'] : ['#EEEDF6', '#E0DCF2'],
    noche: dark ? ['#000000', '#0A0F33'] : ['#E9EEF8', '#D2DDF3'],
  };
  return <LinearGradient pointerEvents="none" colors={native[k] ?? [c.bg, c.surfaceAlt]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />;
}
