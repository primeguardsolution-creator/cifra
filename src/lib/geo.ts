// Location sharing: reading the position, the message format, and the map-tile maths. No imports from React Native (unit-tested in Node).

export type Place = { lat: number; lng: number; label?: string | null };

const round = (n: number) => Math.round(n * 1e5) / 1e5; // ~1 m: enough to find someone, no false precision

/** Message body of a shared location: a readable first line and a plain map link (so it also works as text anywhere). */
export function encodeLocation(p: Place): string {
  const lat = round(p.lat); const lng = round(p.lng);
  const label = (p.label ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
  return `📍 ${label || 'Ubicación'}\nhttps://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

const RE = /^📍 ([^\n]*)\nhttps:\/\/www\.openstreetmap\.org\/\?mlat=(-?\d{1,3}(?:\.\d+)?)&mlon=(-?\d{1,3}(?:\.\d+)?)(?:#\S*)?\s*$/;
/** Reads a location message body; null for anything else. */
export function parseLocation(body?: string | null): (Place & { label: string }) | null {
  const m = body ? RE.exec(body) : null;
  if (!m) return null;
  const lat = Number(m[2]); const lng = Number(m[3]);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
  return { lat, lng, label: m[1] };
}

export type GeoError = 'denied' | 'unavailable' | 'timeout' | 'unsupported';
export const geoSupported = () => typeof navigator !== 'undefined' && !!navigator.geolocation;

/** One high-accuracy reading. Rejects with a GeoError code. */
export function getPosition(timeoutMs = 12000): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!geoSupported()) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 },
    );
  });
}

export const TILE = 256;
/** Tile server. OpenStreetMap by default (free, attribution required); set EXPO_PUBLIC_TILE_URL to a provider template for heavy use. */
export const tileUrl = (z: number, x: number, y: number) => (process.env.EXPO_PUBLIC_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png').replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

/** World pixel position of a coordinate at a zoom level (Web Mercator). */
export function project(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom; const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * n * TILE, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n * TILE };
}

/** The tiles that cover a `w` x `h` window centred on the point, with their offsets inside the window. */
export function tilesFor(lat: number, lng: number, zoom: number, w: number, h: number) {
  const c = project(lat, lng, zoom); const left = c.x - w / 2; const top = c.y - h / 2; const n = 2 ** zoom;
  const out: { key: string; url: string; left: number; top: number }[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + h) / TILE); ty++) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      out.push({ key: `${zoom}/${wx}/${ty}@${tx}`, url: tileUrl(zoom, wx, ty), left: tx * TILE - left, top: ty * TILE - top });
    }
  }
  return out;
}

/** Opens in the map app of the platform: Apple Maps on iPhone/iPad/Mac, Google Maps elsewhere. */
export function mapsLink(p: Place, ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const q = `${round(p.lat)},${round(p.lng)}`;
  return /iPhone|iPad|iPod|Macintosh/i.test(ua) ? `https://maps.apple.com/?ll=${q}&q=${encodeURIComponent(p.label || 'CIFRA')}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}
