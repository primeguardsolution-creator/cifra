// Generates the iOS launch images (apple-touch-startup-image) for the home-screen app. Without one that matches the phone's exact screen,
// iOS shows the app in a smaller, letterboxed frame on newer iPhones. Needs Playwright (global) and public/icon-512.png.
// Run: node scripts/make-splash.mjs  -> public/splash/*.png  (the <link> tags in scripts/head.html match these sizes)
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright');
const SIZES = [ // css width, css height, pixel ratio
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [390, 844, 3], [428, 926, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2], [320, 568, 2],
];
const icon = `data:image/png;base64,${readFileSync('public/icon-512.png').toString('base64')}`;
mkdirSync('public/splash', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
for (const [w, h, dpr] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.setContent(`<body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${icon}" style="width:${Math.round(w * 0.3)}px;height:${Math.round(w * 0.3)}px;border-radius:22%"></body>`);
  await page.screenshot({ path: `public/splash/${w * dpr}x${h * dpr}.png` });
  await page.close();
}
await browser.close();
console.log(SIZES.map(([w, h, d]) => `${w * d}x${h * d}`).join('\n'));
