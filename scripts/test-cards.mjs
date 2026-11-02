const { encodeContact, parseContact, encodeEvent, parseEvent, buildIcs, RSVP } = await import('../src/lib/chatCards.ts');
let passed = 0, failed = 0;
const check = (label, fn) => { try { fn(); passed++; console.log(`  ✓ ${label}`); } catch (e) { failed++; console.log(`  ✗ ${label}\n      ${e.message}`); } };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';

check('contacto: ida y vuelta, sin teléfono, formato estricto', () => {
  const body = encodeContact({ id: ID, name: 'Ana\nPérez' });
  eq(body, `👤 Ana Pérez\ncifra://user/${ID}`);
  eq(parseContact(body), { name: 'Ana Pérez', id: ID });
  for (const bad of [null, '', 'hola', `👤 x\ncifra://user/no-es-uuid`, `👤 x\nhttps://evil.example.com/${ID}`, `texto\n👤 x\ncifra://user/${ID}`, `👤 x\ncifra://user/${ID}\nextra`]) eq(parseContact(bad), null, String(bad));
});
check('evento: ida y vuelta con lugar y notas', () => {
  const start = new Date('2030-11-20T19:00:00.000Z');
  const body = encodeEvent({ title: 'Cena\nde equipo', start, minutes: 90, place: 'Calle Mayor 1', notes: 'Traed ideas' });
  eq(body, '📅 Cena de equipo\n2030-11-20T19:00:00.000Z · 90\n📍 Calle Mayor 1\n📝 Traed ideas');
  const e = parseEvent(body);
  eq([e.title, e.start.toISOString(), e.minutes, e.end.toISOString(), e.place, e.notes], ['Cena de equipo', '2030-11-20T19:00:00.000Z', 90, '2030-11-20T20:30:00.000Z', 'Calle Mayor 1', 'Traed ideas']);
  eq(parseEvent(encodeEvent({ title: 'Solo', start, minutes: 30 })).place, null);
});
check('evento: solo el formato exacto; duración limitada', () => {
  for (const bad of [null, 'hola', '📅 x\nmañana · 30', '📅 x\n2030-11-20T19:00:00Z · 3', '📅 x\n2030-11-20T19:00:00Z · 99999', 'antes\n📅 x\n2030-11-20T19:00:00Z · 30', '📅 x\n2030-13-45T19:00:00Z · 30']) eq(parseEvent(bad), null, String(bad));
  eq(parseEvent(encodeEvent({ title: 'x', start: new Date('2030-01-01T10:00:00Z'), minutes: 2 })).minutes, 5, 'minimum 5');
});
check('ICS válido con escape de caracteres', () => {
  const ics = buildIcs({ title: 'Cena, con; amigos', start: new Date('2030-11-20T19:00:00Z'), minutes: 90, place: 'Bar "X"', notes: 'a\nb' }, 'uid-1');
  for (const part of ['BEGIN:VCALENDAR', 'VERSION:2.0', 'UID:uid-1', 'DTSTART:20301120T190000Z', 'DTEND:20301120T203000Z', 'SUMMARY:Cena\\, con\; amigos', 'LOCATION:Bar "X"', 'DESCRIPTION:a\\nb', 'END:VEVENT', 'END:VCALENDAR']) if (!ics.includes(part)) throw new Error('missing ' + part);
  eq(ics.split('\r\n').length > 8, true);
});
check('RSVP usa solo reacciones permitidas', () => { eq(Object.values(RSVP), ['👍', '😮', '😢']); });
console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
