// Headless-browser check of the call media layer (src/features/calls/mesh.ts): 3-way mesh, staggered joins, screen share, mute flags, leave.
// Dev tool, not part of `npm test` (needs Playwright + Chromium). Run:  CHROMIUM=/path/to/chromium node scripts/test-mesh.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright/index.mjs')); }
const src = readFileSync(fileURLToPath(new URL('../src/features/calls/mesh.ts', import.meta.url)), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const server = createServer((req, res) => { if (req.url === '/mesh.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); } else { res.setHeader('content-type', 'text/html'); res.end('<html><body></body></html>'); } });
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(url);

let failed = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${label}${ok ? '' : ` ${extra}`}`); if (!ok) failed++; };

const result = await page.evaluate(async () => {
  const { MeshRoom } = await import('/mesh.js');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (f, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await wait(100); } return false; };
  const ids = ['aaa', 'bbb', 'ccc'];
  const rooms = {};
  const bus = (from) => (to, event, payload) => new Promise((resolve) => { setTimeout(() => { rooms[to]?.onSignal(event, from, payload); resolve(); }, 5); });
  const fakeScreen = async () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'); let n = 0; setInterval(() => { g.fillStyle = `hsl(${(n += 7) % 360},80%,50%)`; g.fillRect(0, 0, 640, 360); }, 50); return c.captureStream(15); };
  const members = (me) => ids.filter((i) => i !== me).map((i) => ({ id: i, name: i }));
  for (const me of ids) rooms[me] = new MeshRoom({ me, signal: bus(me), createPC: async () => new RTCPeerConnection({ iceServers: [] }), getLocal: (k) => navigator.mediaDevices.getUserMedia({ audio: true, video: k === 'video' }), getScreen: fakeScreen, onChange: () => {} }, 'call1', 'video', members(me));
  const out = {};
  // staggered joins: A first, then B, then C
  await rooms.aaa.join(); await wait(300); await rooms.bbb.join(); await wait(500); await rooms.ccc.join();
  const allConnected = () => ids.every((me) => rooms[me].view().every((p) => p.state === 'connected'));
  out.connected = await until(allConnected);
  out.states = ids.map((me) => rooms[me].view().map((p) => p.state).join(','));
  out.audioTracks = ids.map((me) => rooms[me].view().map((p) => p.stream?.getAudioTracks().length ?? 0).join(','));
  out.videoTracks = ids.map((me) => rooms[me].view().map((p) => p.stream?.getVideoTracks().length ?? 0).join(','));
  out.started = ids.every((me) => !!rooms[me].startedAt);
  // mute / camera flags reach the others
  rooms.bbb.toggleMute(); rooms.bbb.toggleCamera(); await wait(400);
  out.flags = [rooms.aaa, rooms.ccc].map((r) => { const b = r.view().find((p) => p.id === 'bbb'); return `${b.muted}/${b.camOff}`; });
  rooms.bbb.toggleMute(); rooms.bbb.toggleCamera();
  // screen share from A
  await rooms.aaa.startShare();
  out.sharingFlag = await until(() => ['bbb', 'ccc'].every((me) => rooms[me].view().find((p) => p.id === 'aaa').sharing));
  out.screenFrames = await until(() => ['bbb', 'ccc'].every((me) => { const t = rooms[me].view().find((p) => p.id === 'aaa').stream.getVideoTracks()[0]; return t && !t.muted && t.readyState === 'live'; }));
  // the video the others get from A has the screen's size (640x360), not the camera's
  const probe = async (me) => { const v = document.createElement('video'); v.muted = true; v.srcObject = rooms[me].view().find((p) => p.id === 'aaa').stream; await v.play().catch(() => {}); await until(() => v.videoWidth > 0, 8000); const w = v.videoWidth; v.srcObject = null; return w; };
  out.sharedWidth = await probe('bbb');
  await rooms.aaa.stopShare();
  out.sharingStopped = await until(() => ['bbb', 'ccc'].every((me) => !rooms[me].view().find((p) => p.id === 'aaa').sharing));
  // C leaves, then B: A ends alone
  rooms.ccc.leave();
  out.cLeft = await until(() => ['aaa', 'bbb'].every((me) => rooms[me].view().find((p) => p.id === 'ccc').state === 'left'));
  out.abStillConnected = rooms.aaa.view().find((p) => p.id === 'bbb').state === 'connected';
  rooms.bbb.leave();
  out.alone = await until(() => rooms.aaa.isAlone());
  rooms.aaa.leave();
  out.aClosed = rooms.aaa.closed;

  // a voice-only 2-way call can still share a screen (the video line exists from the start)
  const r2 = {};
  const mk = (me, other) => new MeshRoom({ me, signal: (to, ev, p) => new Promise((res) => setTimeout(() => { r2[to]?.onSignal(ev, me, p); res(); }, 5)), createPC: async () => new RTCPeerConnection({ iceServers: [] }), getLocal: (k) => navigator.mediaDevices.getUserMedia({ audio: true, video: k === 'video' }), getScreen: fakeScreen, onChange: () => {} }, 'call2', 'audio', [{ id: other, name: other }]);
  r2.xxx = mk('xxx', 'yyy'); r2.yyy = mk('yyy', 'xxx');
  await r2.xxx.join(); await r2.yyy.join();
  out.voiceConnected = await until(() => r2.xxx.view()[0].state === 'connected' && r2.yyy.view()[0].state === 'connected');
  out.voiceHasNoCamera = r2.xxx.local.getVideoTracks().length === 0;
  await r2.yyy.startShare();
  out.voiceShare = await until(() => { const t = r2.xxx.view()[0].stream.getVideoTracks()[0]; return r2.xxx.view()[0].sharing && t && !t.muted; });
  // decline / busy / missed
  const r3 = {};
  r3.m = new MeshRoom({ me: 'mmm', signal: async () => {}, createPC: async () => new RTCPeerConnection(), getLocal: async () => new MediaStream(), onChange: () => {} }, 'c3', 'audio', [{ id: 'n1', name: 'n1' }, { id: 'n2', name: 'n2' }, { id: 'n3', name: 'n3' }]);
  await r3.m.onSignal('decline', 'n1', {}); await r3.m.onSignal('busy', 'n2', {}); r3.m.markMissed();
  out.outcomes = r3.m.view().map((p) => p.state).join(',');
  out.aloneAfterDecline = r3.m.isAlone();
  return out;
});

check('3 personas con entradas escalonadas: todas conectadas entre sí', result.connected, JSON.stringify(result.states));
check('cada una recibe audio de las otras dos', result.audioTracks.every((x) => x === '1,1'), JSON.stringify(result.audioTracks));
check('cada una recibe línea de vídeo de las otras dos', result.videoTracks.every((x) => x === '1,1'), JSON.stringify(result.videoTracks));
check('el reloj de la llamada arranca', result.started);
check('silencio y cámara apagada llegan a los demás', result.flags.every((f) => f === 'true/true'), JSON.stringify(result.flags));
check('compartir pantalla: los demás reciben el aviso', result.sharingFlag);
check('compartir pantalla: les llegan imágenes en vivo', result.screenFrames);
check('lo que reciben tiene el tamaño de la pantalla compartida (640 px), no el de la cámara', result.sharedWidth === 640, String(result.sharedWidth));
check('dejar de compartir también se avisa', result.sharingStopped);
check('si una persona sale, las otras dos siguen conectadas', result.cLeft && result.abStillConnected);
check('cuando se queda sola, la llamada se da por terminada', result.alone && result.aClosed);
check('llamada de voz entre 2: conecta sin cámara', result.voiceConnected && result.voiceHasNoCamera);
check('llamada de voz: se puede compartir pantalla igualmente', result.voiceShare);
check('rechazada / ocupado / sin respuesta se distinguen', result.outcomes === 'declined,busy,missed', result.outcomes);
check('si todos rechazan, quien llamó se queda solo', result.aloneAfterDecline);
await browser.close(); server.close();
console.log(failed ? `\n${failed} fallaron` : '\ntodo correcto');
process.exit(failed ? 1 : 0);
