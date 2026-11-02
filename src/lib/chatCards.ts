// Contact and event cards inside chat messages. Like locations, they are plain text (readable anywhere) with a strict format. Pure functions, unit-tested in Node.

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const clean = (s: string, max: number) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, max);

// ── Contact: only CIFRA accounts are shared (by id, never by phone number)
export type SharedContact = { id: string; name: string };
export const encodeContact = (c: SharedContact) => `👤 ${clean(c.name, 80) || 'Contacto'}\ncifra://user/${c.id}`;
const CONTACT_RE = new RegExp(`^👤 ([^\\n]{1,80})\\ncifra://user/(${UUID})\\s*$`, 'i');
export function parseContact(body?: string | null): SharedContact | null {
  const m = body ? CONTACT_RE.exec(body) : null;
  return m ? { name: m[1], id: m[2].toLowerCase() } : null;
}

// ── Event: title, start, duration and (optional) place and notes
export type ChatEvent = { title: string; start: Date; minutes: number; place?: string | null; notes?: string | null };
export function encodeEvent(e: ChatEvent): string {
  const lines = [`📅 ${clean(e.title, 80) || 'Evento'}`, `${e.start.toISOString()} · ${Math.max(5, Math.min(1440, Math.round(e.minutes)))}`];
  if (e.place?.trim()) lines.push(`📍 ${clean(e.place, 100)}`);
  if (e.notes?.trim()) lines.push(`📝 ${clean(e.notes, 300)}`);
  return lines.join('\n');
}
const EVENT_RE = /^📅 ([^\n]{1,80})\n(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) · (\d{1,4})(?:\n📍 ([^\n]{1,100}))?(?:\n📝 ([^\n]{1,300}))?\s*$/;
export function parseEvent(body?: string | null): (ChatEvent & { end: Date }) | null {
  const m = body ? EVENT_RE.exec(body) : null;
  if (!m) return null;
  const start = new Date(m[2]); const minutes = Number(m[3]);
  if (Number.isNaN(start.getTime()) || minutes < 5 || minutes > 1440) return null;
  return { title: m[1], start, minutes, end: new Date(start.getTime() + minutes * 60000), place: m[4] ?? null, notes: m[5] ?? null };
}

/** iCalendar file (RFC 5545) so the event can be added to any calendar app. */
export function buildIcs(e: ChatEvent & { end?: Date }, uid = `${e.start.getTime()}@cifra`): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const end = e.end ?? new Date(e.start.getTime() + e.minutes * 60000);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CIFRA//Chat//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(e.start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${esc(e.title)}`,
    ...(e.place ? [`LOCATION:${esc(e.place)}`] : []), ...(e.notes ? [`DESCRIPTION:${esc(e.notes)}`] : []), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

/** RSVP: the three reactions the app already allows. */
export const RSVP = { going: '👍', maybe: '😮', no: '😢' } as const;
