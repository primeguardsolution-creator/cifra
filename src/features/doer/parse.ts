// English and German interpreters for Doer (the Spanish one lives in actions.ts). Pure TypeScript, tested in Node.
import type { DoerAction, DoerReply } from './actions';

type L = 'en' | 'de';
const norm = (s: string) => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const W = {
  en: {
    today: 'today', tomorrow: 'tomorrow', after: 'day after tomorrow',
    days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    months: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
    inH: /\bin (\d{1,2}) hours?\b/, inD: /\bin (\d{1,2}) days?\b/,
    time: /\b(?:at|around|by) (\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|in the morning|in the afternoon|in the evening|at night)?\b/,
    time2: /\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/,
    dayNum: /\b(?:on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)\b(?: of (\w+))?/,
    monthDay: /\b(\w+) (\d{1,2})(?:st|nd|rd|th)?\b/,
    dayMonth: /\b(\d{1,2})(?:st|nd|rd|th)? (?:of )?(\w+)\b/,
  },
  de: {
    today: 'heute', tomorrow: 'morgen', after: 'ubermorgen',
    days: ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'],
    months: ['januar', 'februar', 'marz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'],
    inH: /\bin (\d{1,2}) stunden?\b/, inD: /\bin (\d{1,2}) tagen?\b/,
    time: /\b(?:um|gegen) (\d{1,2})(?:[:.h](\d{2}))?\s*(uhr)?\b/,
    time2: /\b(\d{1,2})[:.](\d{2})\s*(uhr)?\b/,
    dayNum: /\bam (\d{1,2})\.?(?:\s+(\w+))?\b/,
    monthDay: /^$/,
    dayMonth: /\b(\d{1,2})\.? (\w+)\b/,
  },
} as const;

export function parseWhenLoc(text: string, now: Date, l: L): { date: Date; hasTime: boolean } | null {
  const w = W[l] as { today: string; tomorrow: string; after: string; days: readonly string[]; months: readonly string[]; inH: RegExp; inD: RegExp; time: RegExp; time2: RegExp; dayNum: RegExp; monthDay: RegExp; dayMonth: RegExp };
  const t = norm(text);
  const base = new Date(now); base.setSeconds(0, 0);
  const inH = t.match(w.inH);
  if (inH) return { date: new Date(base.getTime() + Number(inH[1]) * 3600e3), hasTime: true };
  let d: Date | null = null;
  const reWord = (x: string) => new RegExp(`\\b${x}\\b`);
  if (reWord(w.after).test(t)) { d = new Date(base); d.setDate(d.getDate() + 2); }
  else if (reWord(w.tomorrow).test(t)) { d = new Date(base); d.setDate(d.getDate() + 1); }
  else if (reWord(w.today).test(t)) d = new Date(base);
  else if (w.inD.test(t)) { d = new Date(base); d.setDate(d.getDate() + Number(t.match(w.inD)![1])); }
  else {
    const wd = w.days.findIndex((n) => reWord(n).test(t));
    if (wd >= 0) { d = new Date(base); const delta = ((wd - d.getDay() + 7) % 7) || 7; d.setDate(d.getDate() + delta); }
    else {
      let day = 0; let mi = -1;
      const a = t.match(w.dayMonth); if (a && w.months.indexOf(a[2]) >= 0) { day = Number(a[1]); mi = w.months.indexOf(a[2]); }
      if (mi < 0 && l === 'en') { const b = t.match(w.monthDay); if (b && w.months.indexOf(b[1]) >= 0) { day = Number(b[2]); mi = w.months.indexOf(b[1]); } }
      if (mi < 0) { const c = t.match(w.dayNum); if (c && c[2] && w.months.indexOf(c[2]) >= 0) { day = Number(c[1]); mi = w.months.indexOf(c[2]); } }
      if (mi >= 0 && day >= 1 && day <= 31) { d = new Date(base.getFullYear(), mi, day); if (d < new Date(base.getFullYear(), base.getMonth(), base.getDate())) d.setFullYear(d.getFullYear() + 1); }
    }
  }
  const tm = t.match(w.time) ?? t.match(w.time2);
  let hasTime = false;
  if (tm && d) {
    let h = Number(tm[1]); const m = tm[2] ? Number(tm[2]) : 0; const ap = tm[3];
    if (ap && /pm|afternoon|evening|night/.test(ap) && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (!ap && l === 'en' && h >= 1 && h <= 7) h += 12;
    if (l === 'de' && !ap && h >= 1 && h <= 7 && !/\buhr\b/.test(t)) h += 12;
    d.setHours(h, m, 0, 0); hasTime = true;
  }
  if (!d) return null;
  if (!hasTime) d.setHours(10, 0, 0, 0);
  return { date: d, hasTime };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const R = {
  en: {
    quick: /(?:create|add|make|new|save)\s+(?:a\s+)?quick\s+reply\s+["“]?([\w-]{2,20})["”]?\s*[:\-–]\s*([\s\S]+)/i,
    greet: /(?:set|change|create|configure|put)\s+(?:the\s+|a\s+|my\s+)?(?:welcome\s+)?(?:greeting|welcome(?:\s+message)?)[^:]*[:\-–]\s*([\s\S]+)/i,
    away: /(?:set|change|create|turn on|configure)\s+(?:the\s+|an?\s+|my\s+)?(?:away|out[- ]of[- ]office)(?:\s+message)?[^:]*[:\-–]\s*([\s\S]+)/i,
    awayOff: /\b(turn off|disable|deactivate|switch off)\b.*\b(away|out of office)\b/, awayOn: /\b(turn on|enable|activate|switch on)\b.*\b(away|out of office)\b/,
    msg: /(?:send|message|write|text)\s+(?:a\s+message\s+)?(?:to\s+)?([^:]+?)\s*[:\-–]\s*([\s\S]+)/i,
    apptNoun: /\b(appointment|meeting|visit|booking|consultation)\b/, apptVerb: /\b(book|schedule|add|create|set up|make|arrange)\b/,
    task: /(?:create|add|new|make)\s+(?:a\s+)?(?:task|reminder)\s*[:\-–]?\s*([\s\S]+)/i, remind: /remind me (?:to )?([\s\S]+)/i,
    product: /(?:add|create|new|publish)\s+(?:a\s+)?(?:product|service|item)\s*[:\-–]?\s*([^\d€$]+?)\s*(?:for|at|costs?|:)?\s*(\d+(?:[.,]\d{1,2})?)\s*(€|eur|euros?|usd|\$|dollars?)?/i,
    customer: /(?:add|create|new|save)\s+(?:a\s+)?customer\s*[:\-–]?\s*([^,:\d]+?)(?:\s*[,:]?\s*(?:phone|mobile)?\s*(\+?\d[\d\s]{6,}))?\s*$/i,
    move: /\b(?:move|mark|set)\b.*\b(?:to|as)\s+(won|lost|proposal|in contact|new)\b/,
    stages: { won: 'won', lost: 'lost', proposal: 'proposal', 'in contact': 'contacted', new: 'lead' } as Record<string, string>,
    open: [[/\b(open|go to|show me|take me to)\b.*\b(agenda|calendar|appointments)\b/, 'agenda'], [/\b(open|go to|show me|take me to)\b.*\b(customers|crm)\b/, 'clients'], [/\b(open|go to|show me|take me to)\b.*\b(catalog|products)\b/, 'catalog'], [/\b(open|go to|show me|take me to)\b.*\b(inbox|chats|messages)\b/, 'inbox'], [/\b(open|go to|show me|take me to)\b.*\b(business|team|profile)\b/, 'business']] as [RegExp, DoerAction extends { screen: infer S } ? S : never][],
    kinds: { appointment: 'Appointment', meeting: 'Meeting', visit: 'Visit', booking: 'Booking', consultation: 'Consultation' } as Record<string, string>,
    dur: /\b(\d{1,3}) ?(?:min|minutes)\b/, hour: /\ban hour\b|\b1 ?h\b|\b1 hour\b/,
    strip: /\b(day after tomorrow|tomorrow|today|(?:on )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|(?:on )?(?:the )?\d{1,2}(?:st|nd|rd|th)(?: of \w+)?|in \d{1,2} (?:hours?|days?))\b|\b(?:at|around|by) \d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm)?\b/gi,
    lead: /^(that|to|about)\s+/i,
  },
  de: {
    quick: /(?:erstelle|füge|fuge|lege|neue|speichere)\s+(?:eine\s+)?schnellantwort\s+["„]?([\wäöüß-]{2,20})["“]?\s*[:\-–]\s*([\s\S]+)/i,
    greet: /(?:setze|ändere|andere|erstelle|stelle)\s+(?:die\s+|eine\s+|meine\s+)?(?:begrüßung|begrussung|willkommensnachricht)[^:]*[:\-–]\s*([\s\S]+)/i,
    away: /(?:setze|ändere|andere|erstelle|aktiviere|stelle)\s+(?:die\s+|eine\s+|meine\s+)?abwesenheit(?:snachricht)?[^:]*[:\-–]\s*([\s\S]+)/i,
    awayOff: /\b(deaktiviere|schalte|beende)\b.*\babwesenheit\b.*\b(aus|ab)\b|\bdeaktiviere\b.*\babwesenheit\b/, awayOn: /\b(aktiviere|schalte)\b.*\babwesenheit\b/,
    msg: /(?:schreibe|sende|schicke)\s+(?:eine\s+nachricht\s+)?an\s+([^:]+?)\s*[:\-–]\s*([\s\S]+)/i,
    apptNoun: /\b(termin|besprechung|besuch|buchung|beratung)\b/, apptVerb: /\b(trage|buche|erstelle|vereinbare|plane|fuge|lege|neuer|neue)\b/,
    task: /(?:erstelle|füge|fuge|neue)\s+(?:eine\s+)?(?:aufgabe|erinnerung)\s*[:\-–]?\s*([\s\S]+)/i, remind: /erinnere mich (?:daran,? )?([\s\S]+)/i,
    product: /(?:füge|fuge|erstelle|neues|veröffentliche|veroffentliche)\s+(?:ein\s+)?(?:produkt|leistung|artikel)\s*[:\-–]?\s*([^\d€$]+?)\s*(?:für|fur|zu|kostet|:)?\s*(\d+(?:[.,]\d{1,2})?)\s*(€|eur|euro|usd|\$|dollar)?/i,
    customer: /(?:füge|fuge|erstelle|neuer|speichere)\s+(?:einen\s+)?kunden\s*[:\-–]?\s*([^,:\d]+?)(?:\s*[,:]?\s*(?:telefon|handy)?\s*(\+?\d[\d\s]{6,}))?(?:\s+hinzu)?\s*$/i,
    move: /\b(?:verschiebe|markiere|setze)\b.*\b(?:zu|auf|als)\s+(gewonnen|verloren|angebot|im gesprach|neu)\b/,
    stages: { gewonnen: 'won', verloren: 'lost', angebot: 'proposal', 'im gesprach': 'contacted', neu: 'lead' } as Record<string, string>,
    open: [[/\b(offne|gehe zu|zeige mir)\b.*\b(kalender|termine)\b/, 'agenda'], [/\b(offne|gehe zu|zeige mir)\b.*\b(kunden|crm)\b/, 'clients'], [/\b(offne|gehe zu|zeige mir)\b.*\b(katalog|produkte)\b/, 'catalog'], [/\b(offne|gehe zu|zeige mir)\b.*\b(posteingang|chats|nachrichten)\b/, 'inbox'], [/\b(offne|gehe zu|zeige mir)\b.*\b(unternehmen|team|profil)\b/, 'business']] as [RegExp, DoerAction extends { screen: infer S } ? S : never][],
    kinds: { termin: 'Termin', besprechung: 'Besprechung', besuch: 'Besuch', buchung: 'Buchung', beratung: 'Beratung' } as Record<string, string>,
    dur: /\b(\d{1,3}) ?(?:min|minuten)\b/, hour: /\beine stunde\b|\b1 ?std\b/,
    strip: /\b(ubermorgen|morgen|heute|am (?:sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)|(?:sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)|am \d{1,2}\.?(?: \w+)?|in \d{1,2} (?:stunden?|tagen?))\b|\b(?:um|gegen) \d{1,2}(?:[:.h]\d{2})?\s*(?:uhr)?\b/gi,
    lead: /^(dass|zu|daran)\s+/i,
  },
} as const;

const REPLIES = {
  en: { quick: (s: string) => `Ready to save the quick reply /${s}.`, greet: 'Every new customer will get this greeting automatically.', away: 'I turn on the away message with this text.', awayOff: 'I turn off the away message.', awayOn: 'I turn on the away message you already saved.', msg: (c: string) => `I schedule the message for ${c}.`, appt: (k: string, c?: string) => (c ? `I book the ${k.toLowerCase()} with ${c}.` : `I book the ${k.toLowerCase()}.`), taskDate: 'I create the task with its date.', taskNo: 'I create the task (no date).', product: (n: string) => `I publish “${n}” in your catalog.`, customer: (n: string) => `I add ${n} to your customers.`, move: (c: string, s: string) => `I move ${c} to “${s}”.`, open: 'On my way.' },
  de: { quick: (s: string) => `Bereit, die Schnellantwort /${s} zu speichern.`, greet: 'Jeder neue Kunde erhält diese Begrüßung automatisch.', away: 'Ich aktiviere die Abwesenheit mit diesem Text.', awayOff: 'Ich schalte die Abwesenheitsnachricht aus.', awayOn: 'Ich aktiviere die bereits gespeicherte Abwesenheitsnachricht.', msg: (c: string) => `Ich plane die Nachricht für ${c}.`, appt: (k: string, c?: string) => (c ? `Ich trage den Termin (${k}) mit ${c} ein.` : `Ich trage den Termin (${k}) ein.`), taskDate: 'Ich lege die Aufgabe mit Datum an.', taskNo: 'Ich lege die Aufgabe an (ohne Datum).', product: (n: string) => `Ich veröffentliche „${n}“ in deinem Katalog.`, customer: (n: string) => `Ich füge ${n} zu deinen Kunden hinzu.`, move: (c: string, s: string) => `Ich verschiebe ${c} zu „${s}“.`, open: 'Ich gehe hin.' },
} as const;

export type Known = { customers: string[] };

export function interpretLoc(input: string, known: Known, now: Date, l: L): DoerReply | null {
  const raw = input.trim();
  const t = norm(raw);
  if (!t) return null;
  const r = R[l]; const re = REPLIES[l];
  const findCustomer = (text: string) => { const n = norm(text); return known.customers.find((c) => n.includes(norm(c))) ?? known.customers.find((c) => norm(c).split(' ').some((w) => w.length > 2 && new RegExp(`\\b${w}\\b`).test(n))); };

  let m = raw.match(r.quick);
  if (m) return { reply: re.quick(norm(m[1]).replace(/[^a-z0-9_-]/g, '')), actions: [{ type: 'quick_reply', shortcut: norm(m[1]).replace(/[^a-z0-9_-]/g, ''), body: m[2].trim() }] };
  m = raw.match(r.greet);
  if (m) return { reply: re.greet, actions: [{ type: 'greeting', text: m[1].trim() }] };
  m = raw.match(r.away);
  if (m) return { reply: re.away, actions: [{ type: 'away', text: m[1].trim(), enabled: true }] };
  if (r.awayOff.test(t)) return { reply: re.awayOff, actions: [{ type: 'away', enabled: false }] };
  if (r.awayOn.test(t)) return { reply: re.awayOn, actions: [{ type: 'away', enabled: true }] };

  m = raw.match(r.msg);
  if (m) {
    const when = parseWhenLoc(m[1], now, l); const cust = findCustomer(m[1]);
    if (cust && when) return { reply: re.msg(cust), actions: [{ type: 'scheduled_message', customer: cust, text: m[2].trim(), when: localIso(when.date) }] };
  }

  const noun = t.match(r.apptNoun);
  if (noun && r.apptVerb.test(t)) {
    const when = parseWhenLoc(raw, now, l);
    if (when) {
      const cust = findCustomer(raw);
      const kind = r.kinds[noun[1]] ?? cap(noun[1]);
      const d = t.match(r.dur) ? Number(t.match(r.dur)![1]) : r.hour.test(t) ? 60 : 30;
      return { reply: re.appt(kind, cust), actions: [{ type: 'appointment', customer: cust, title: cust ? `${kind} · ${cust}` : kind, start: localIso(when.date), minutes: d }] };
    }
  }

  m = raw.match(r.task) ?? raw.match(r.remind);
  if (m) {
    const when = parseWhenLoc(m[1], now, l);
    const title = m[1].replace(r.strip, ' ').replace(/\s+/g, ' ').trim().replace(r.lead, '') || m[1];
    return { reply: when ? re.taskDate : re.taskNo, actions: [{ type: 'task', title: cap(title), due: when ? localIso(when.date) : undefined, customer: findCustomer(m[1]) }] };
  }

  m = raw.match(r.product);
  if (m) {
    const cur = /usd|\$|dollar/i.test(m[3] ?? '') ? 'USD' : 'EUR';
    return { reply: re.product(m[1].trim()), actions: [{ type: 'product', name: m[1].trim().replace(/[,:]$/, ''), price: Number(m[2].replace(',', '.')), currency: cur }] };
  }
  m = raw.match(r.customer);
  if (m && m[1].trim()) return { reply: re.customer(m[1].trim()), actions: [{ type: 'customer', name: m[1].trim(), phone: m[2]?.trim() }] };

  const mv = t.match(r.move);
  if (mv) {
    const cust = findCustomer(raw);
    if (cust) return { reply: re.move(cust, mv[1]), actions: [{ type: 'customer_update', customer: cust, stage: r.stages[mv[1]] }] };
  }
  for (const [rx, screen] of r.open) if (rx.test(t)) return { reply: re.open, actions: [{ type: 'open', screen }] };
  return null;
}
