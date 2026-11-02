const { encodeLocation, parseLocation, project, tilesFor, mapsLink } = await import('../src/lib/geo.ts');
let passed = 0, failed = 0;
const check = (label, fn) => { try { fn(); passed++; console.log(`  ✓ ${label}`); } catch (e) { failed++; console.log(`  ✗ ${label}\n      ${e.message}`); } };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };

check('el mensaje de ubicación se codifica y se lee de vuelta', () => {
  const body = encodeLocation({ lat: 52.520008123, lng: 13.404954321, label: 'Mi oficina' });
  eq(body, '📍 Mi oficina\nhttps://www.openstreetmap.org/?mlat=52.52001&mlon=13.40495#map=17/52.52001/13.40495');
  eq(parseLocation(body), { lat: 52.52001, lng: 13.40495, label: 'Mi oficina' });
  eq(parseLocation(encodeLocation({ lat: -33.8688, lng: 151.2093 })).label, 'Ubicación');
  eq(parseLocation(encodeLocation({ lat: -33.8688, lng: -70.1, label: 'a\nb' })).label, 'a b', 'newlines in the label cannot break the format');
});
check('solo se reconoce el formato exacto (un mensaje normal nunca es una ubicación)', () => {
  for (const bad of [null, '', 'hola', '📍 sitio', '📍 x\nhttps://evil.example.com/?mlat=1&mlon=2', '📍 x\nhttps://www.openstreetmap.org/?mlat=95&mlon=2', 'texto antes\n📍 x\nhttps://www.openstreetmap.org/?mlat=1&mlon=2', '📍 x\nhttps://www.openstreetmap.org/?mlat=1&mlon=2 y más texto']) eq(parseLocation(bad), null, String(bad));
});
check('proyección Web Mercator conocida (Greenwich, zoom 1)', () => {
  const p = project(0, 0, 1); eq([p.x, p.y], [256, 256]);
  const q = project(0, -180, 0); eq(q.x, 0);
});
check('los teselas cubren la ventana y el punto cae en el centro', () => {
  const tiles = tilesFor(52.52, 13.405, 16, 260, 150);
  if (tiles.length < 2 || tiles.length > 6) throw new Error('tiles: ' + tiles.length);
  const covers = (x, y) => tiles.some((t) => x >= t.left && x < t.left + 256 && y >= t.top && y < t.top + 256);
  for (const [x, y] of [[0, 0], [259, 0], [0, 149], [259, 149], [130, 75]]) if (!covers(x, y)) throw new Error(`pixel ${x},${y} not covered`);
  eq(tiles[0].url.startsWith('https://tile.openstreetmap.org/16/'), true);
});
check('enlace de mapas según plataforma', () => {
  eq(mapsLink({ lat: 1, lng: 2, label: 'X' }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)').startsWith('https://maps.apple.com/'), true);
  eq(mapsLink({ lat: 1, lng: 2 }, 'Mozilla/5.0 (Linux; Android 14)').startsWith('https://www.google.com/maps/'), true);
});
console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
