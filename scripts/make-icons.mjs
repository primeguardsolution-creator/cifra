// Generates every app icon from the vector design (two speech bubbles) in five "eras". Dev tool, not part of the build:
//   node scripts/make-icons.mjs        (needs Playwright + Chromium and Pillow for favicon.ico)
// Output: public/icons/<variant>/*, and for the default variant the root PWA icons and the Expo assets.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const left = 'M 215 295 H 340 A 150 150 0 0 1 490 445 V 480 C 490 625 430 712 322 737 V 665 Q 322 625 282 625 H 215 Q 152 625 152 565 V 360 Q 152 295 215 295 Z';
const stop = (o, c) => `<stop offset="${o}" stop-color="${c}"/>`;
const grad = (id, a, b, x2 = 1, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stop(0, a)}${stop(1, b)}</linearGradient>`;

// each variant: label, theme colour, background (svg), left and right bubble fills, optional defs / extra layers
export const variants = {
  moderno: { label: 'Moderno', theme: '#1B1A2B',
    defs: grad('bg', '#22213A', '#12111C') + grad('l', '#9B72F5', '#7C52E0'),
    bg: '<rect width="1024" height="1024" fill="url(#bg)"/>', l: 'url(#l)', r: '#FBF4ED' },
  clasico: { label: 'Clásico B/N', theme: '#E4DCC6',
    defs: '<radialGradient id="bg" cx="0.5" cy="0.45" r="0.75">' + stop(0, '#F1EBDC') + stop(1, '#D6CCB2') + '</radialGradient>',
    bg: '<rect width="1024" height="1024" fill="url(#bg)"/><rect x="38" y="38" width="948" height="948" rx="190" fill="none" stroke="#1A1A1A" stroke-opacity=".18" stroke-width="6"/>',
    l: '#171717', r: 'none', rStroke: '#171717' },
  retro70: { label: 'Retro 70', theme: '#A8431A',
    defs: grad('bg', '#CB5A1E', '#84300F') + grad('l', '#F7C23D', '#E9A21E'),
    bg: '<rect width="1024" height="1024" fill="url(#bg)"/>', l: 'url(#l)', r: '#F8EBD3' },
  neon80: { label: 'Neón 80', theme: '#12082E',
    defs: grad('bg', '#1B0B40', '#080414') + '<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
    bg: '<rect width="1024" height="1024" fill="url(#bg)"/><path d="M0 760 H1024 M0 830 H1024 M0 920 H1024" stroke="#FF2E93" stroke-opacity=".22" stroke-width="4"/>',
    l: '#FF3D9A', r: '#27E6F7', glow: true },
  y2k: { label: 'Y2K', theme: '#1D74DC',
    defs: grad('bg', '#4FD0F7', '#1259CF') + grad('l', '#FFFFFF', '#C7D8EE') + grad('r', '#D6FF63', '#8FE02B') + '<radialGradient id="shine" cx="0.5" cy="0" r="0.9">' + stop(0, '#FFFFFF') + '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>',
    bg: '<rect width="1024" height="1024" fill="url(#bg)"/><ellipse cx="512" cy="40" rx="620" ry="380" fill="url(#shine)" opacity=".45"/>', l: 'url(#l)', r: 'url(#r)' },
};

/** The icon as SVG. `mode`: 'square' (full-bleed), 'round' (transparent corners), 'mark' (only the bubbles, for Android adaptive / monochrome). `scale` shrinks the bubbles toward the centre (safe zones). */
export function iconSvg(key, mode = 'square', scale = 1, mono = null) {
  const v = variants[key];
  const bubbles = (fillL, fillR, strokeR) => `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)"${v.glow && !mono ? ' filter="url(#glow)"' : ''}>
    <path d="${left}" fill="${fillL}"/>
    <path d="${left}" fill="${fillR}"${strokeR ? ` stroke="${strokeR}" stroke-width="26" stroke-linejoin="round"` : ''} transform="translate(1024 0) scale(-1 1)"/></g>`;
  const clip = mode === 'round' ? '<clipPath id="rc"><rect width="1024" height="1024" rx="228"/></clipPath>' : '';
  const body = mode === 'mark' ? bubbles(mono ?? v.l, mono ?? v.r, mono ? null : v.rStroke) : `<g${mode === 'round' ? ' clip-path="url(#rc)"' : ''}>${v.bg}${bubbles(v.l, v.r, v.rStroke)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${v.defs}${clip}</defs>${body}</svg>`;
}

const browser = await chromium.launch({ args: ['--no-sandbox'], ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
async function png(svg, size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent"><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`);
  await page.waitForTimeout(60);
  await page.screenshot({ path: file, omitBackground: true }); await page.close();
}

for (const key of Object.keys(variants)) {
  const dir = `public/icons/${key}`; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/icon.svg`, iconSvg(key, 'round'));
  await png(iconSvg(key, 'square'), 180, `${dir}/apple-touch-icon.png`);
  for (const s of [192, 512]) { await png(iconSvg(key, 'round'), s, `${dir}/icon-${s}.png`); await png(iconSvg(key, 'square', 0.78), s, `${dir}/icon-${s}-maskable.png`); }
  await png(iconSvg(key, 'round'), 32, `${dir}/favicon-32.png`);
  await png(iconSvg(key, 'round'), 128, `${dir}/preview.png`);
}

// the default variant is the app's identity everywhere else
const d = 'moderno';
for (const f of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'favicon-32.png']) copyFileSync(`public/icons/${d}/${f}`, `public/${f}`);
copyFileSync(`public/icons/${d}/icon-192-maskable.png`, 'public/icon-192-maskable.png'); copyFileSync(`public/icons/${d}/icon-512-maskable.png`, 'public/icon-512-maskable.png');
await png(iconSvg(d, 'square'), 1024, 'assets/icon.png');
await png(iconSvg(d, 'round'), 1024, 'assets/cifra-logo.png');
await png(iconSvg(d, 'round'), 1024, 'assets/splash-icon.png');
await png(iconSvg(d, 'round'), 48, 'assets/favicon.png');
await png(iconSvg(d, 'mark', 0.62), 1024, 'assets/android-icon-foreground.png');
await png(iconSvg(d, 'mark', 0.62, '#000000'), 432, 'assets/android-icon-monochrome.png');
writeFileSync('/tmp/cifra-adaptive-bg.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${variants[d].defs}</defs>${variants[d].bg}</svg>`);
await png(readSvg('/tmp/cifra-adaptive-bg.svg'), 1024, 'assets/android-icon-background.png');
function readSvg(p) { return execFileSync('cat', [p]).toString(); }
await browser.close();
execFileSync('python3', ['-c', "from PIL import Image; im=Image.open('public/icons/moderno/favicon-32.png'); im.save('public/favicon.ico', sizes=[(16,16),(32,32)])"]);
console.log('icons ready');
