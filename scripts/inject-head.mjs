// Expo's "single" web output writes a bare index.html (it ignores app/+html.tsx), so everything a PWA needs in <head> is added here after the build:
// viewport-fit=cover, iOS home-screen meta (status bar), manifest and icons, Open Graph / Twitter tags, base colours and the icon-variant script.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] ?? 'dist/index.html';
let html = readFileSync(file, 'utf8');
const head = readFileSync(new URL('./head.html', import.meta.url), 'utf8');
html = html.replace(/<html lang="[^"]*">/, '<html lang="es">').replace(/\s*<meta name="viewport"[^>]*>/, '');
if (!html.includes('</head>')) throw new Error('index.html has no </head>');
html = html.replace('</head>', `${head}  </head>`);
writeFileSync(file, html);
console.log('head injected into', file);
