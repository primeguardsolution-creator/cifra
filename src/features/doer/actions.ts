// Doer: turns "do this for me" into a short list of typed actions the user confirms. Pure TypeScript (no React) so it can be tested in Node.

import { interpretLoc } from './parse';

export type DoerAction =
  | { type: 'quick_reply'; shortcut: string; body: string }
  | { type: 'greeting'; text: string }
  | { type: 'away'; text?: string; enabled: boolean }
  | { type: 'appointment'; customer?: string; title: string; start: string; minutes: number }
  | { type: 'task'; title: string; due?: string; customer?: string }
  | { type: 'product'; name: string; price?: number; currency?: string; description?: string }
  | { type: 'customer'; name: string; phone?: string; stage?: string; notes?: string }
  | { type: 'customer_update'; customer: string; stage?: string; tag?: string; note?: string }
  | { type: 'scheduled_message'; customer: string; text: string; when: string }
  | { type: 'open'; screen: 'agenda' | 'clients' | 'catalog' | 'business' | 'inbox' };

export type DoerReply = { reply: string; actions: DoerAction[] };

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Local ISO without timezone ("2026-10-30T10:00"), which the app reads as the user's own clock. */
export const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Understands "mañana a las 10", "el viernes 17:30", "pasado mañana", "el 15 de noviembre a las 9", "hoy a las 18", "en 2 horas". */
export function parseWhen(text: string, now = new Date()): { date: Date; hasTime: boolean } | null {
  const t = norm(text);
  let d: Date | null = null;
  const base = new Date(now); base.setSeconds(0, 0);
  const inH = t.match(/\ben (\d{1,2}) horas?\b/);
  if (inH) return { date: new Date(base.getTime() + Number(inH[1]) * 3600e3), hasTime: true };
  const inD = t.match(/\ben (\d{1,2}) dias?\b/);
  if (/\bpasado manana\b/.test(t)) { d = new Date(base); d.setDate(d.getDate() + 2); }
  else if (/\bmanana\b/.test(t)) { d = new Date(base); d.setDate(d.getDate() + 1); }
  else if (/\bhoy\b/.test(t)) d = new Date(base);
  else if (inD) { d = new Date(base); d.setDate(d.getDate() + Number(inD[1])); }
  else {
    const wd = DAYS.findIndex((n) => new RegExp(`\\b${n}\\b`).test(t));
    if (wd >= 0) { d = new Date(base); const delta = ((wd - d.getDay() + 7) % 7) || 7; d.setDate(d.getDate() + delta); }
    else {
      const md = t.match(/\b(?:el )?(\d{1,2}) de (\w+)/);
      const mi = md ? MONTHS.indexOf(md[2]) : -1;
      if (md && mi >= 0) { d = new Date(base.getFullYear(), mi, Number(md[1])); if (d < new Date(base.getFullYear(), base.getMonth(), base.getDate())) d.setFullYear(d.getFullYear() + 1); }
      else {
        const sl = t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
        if (sl) { d = new Date(sl[3] ? (sl[3].length === 2 ? 2000 + Number(sl[3]) : Number(sl[3])) : base.getFullYear(), Number(sl[2]) - 1, Number(sl[1])); if (!sl[3] && d < new Date(base.getFullYear(), base.getMonth(), base.getDate())) d.setFullYear(d.getFullYear() + 1); }
        else { const day = t.match(/\bel (\d{1,2})\b(?! (?:de )?\w*(?:h|:))/); if (day && Number(day[1]) <= 31) { d = new Date(base.getFullYear(), base.getMonth(), Number(day[1])); if (d < new Date(base.getFullYear(), base.getMonth(), base.getDate())) d.setMonth(d.getMonth() + 1); } }
      }
    }
  }
  const tm = t.match(/\b(?:a las?|sobre las?|las?) (\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|de la tarde|de la manana|de la noche)?\b/) ?? t.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/);
  let hasTime = false;
  if (tm && d) {
    let h = Number(tm[1]); const m = tm[2] ? Number(tm[2]) : 0; const ap = tm[3];
    if (ap && /pm|tarde|noche/.test(ap) && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (!ap && h >= 1 && h <= 7) h += 12; // "a las 5" for an appointment means 17:00
    d.setHours(h, m, 0, 0); hasTime = true;
  }
  if (!d) return null;
  if (!hasTime) d.setHours(10, 0, 0, 0);
  return { date: d, hasTime };
}

const stripWhen = (s: string) => s
  .replace(/\b(pasado manana|manana|hoy|el (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)|(?:el )?\d{1,2} de [a-z]+|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|en \d{1,2} (?:horas?|dias?))\b/gi, ' ')
  .replace(/\b(?:a las?|sobre las?|las?) \d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm|de la tarde|de la manana|de la noche|h)?\b/gi, ' ')
  .replace(/\s+/g, ' ').trim();

export type Known = { customers: string[] };

const findCustomer = (text: string, known: Known): string | undefined => {
  const t = norm(text);
  return known.customers.find((n) => t.includes(norm(n))) ?? known.customers.find((n) => norm(n).split(' ').some((w) => w.length > 2 && new RegExp(`\\b${w}\\b`).test(t)));
};

/** Offline interpreter for the most common requests. Returns null when it can't be sure, so the AI (or a clarifying question) takes over. */
export function interpret(input: string, known: Known, now = new Date(), locale: 'es' | 'en' | 'de' = 'es'): DoerReply | null {
  if (locale !== 'es') return interpretLoc(input, known, now, locale);
  const raw = input.trim();
  const t = norm(raw);
  if (!t) return null;
  const after = (re: RegExp) => { const m = raw.match(re); return m ? m[m.length - 1].trim() : ''; };

  // quick reply: "crea una respuesta rápida horario: abrimos de 9 a 18"
  let m = raw.match(/(?:crea|a[ñn]ade|haz|nueva|guarda|programa)\s+(?:una\s+)?respuesta\s+r[aá]pida(?:\s+(?:llamada|con\s+(?:el\s+)?atajo|para))?\s+["“]?([\wáéíóúñ-]{2,20})["”]?\s*[:\-–]\s*([\s\S]+)/i);
  if (m) return { reply: `Listo para guardar la respuesta rápida /${norm(m[1]).replace(/\s/g, '')}.`, actions: [{ type: 'quick_reply', shortcut: norm(m[1]).replace(/[^a-z0-9_-]/g, ''), body: m[2].trim() }] };

  // greeting
  m = raw.match(/(?:pon|programa|configura|cambia|crea|activa|deja)\s+(?:el\s+|la\s+|un\s+|mi\s+)?(?:mensaje\s+de\s+)?(?:saludo|bienvenida)[^:]*[:\-–]\s*([\s\S]+)/i);
  if (m) return { reply: 'Cada cliente nuevo recibirá este saludo automáticamente.', actions: [{ type: 'greeting', text: m[1].trim() }] };

  // away
  m = raw.match(/(?:pon|programa|configura|cambia|crea|activa|deja)\s+(?:el\s+|la\s+|un\s+|mi\s+)?(?:mensaje\s+de\s+)?ausencia[^:]*[:\-–]\s*([\s\S]+)/i);
  if (m) return { reply: 'Activo la ausencia con este mensaje.', actions: [{ type: 'away', text: m[1].trim(), enabled: true }] };
  if (/\b(desactiva|apaga|quita)\b.*\bausencia\b/.test(t)) return { reply: 'Apago el mensaje de ausencia.', actions: [{ type: 'away', enabled: false }] };
  if (/\b(activa|enciende|pon)\b.*\bausencia\b/.test(t)) return { reply: 'Activo el mensaje de ausencia que ya tienes guardado.', actions: [{ type: 'away', enabled: true }] };

  // scheduled message to a customer: "envía a Ana mañana a las 9: tu pedido está listo"
  m = raw.match(/(?:env[ií]a|manda|escribe|programa)\s+(?:un\s+)?(?:mensaje\s+)?(?:a|para)\s+([^:]+?)\s*[:\-–]\s*([\s\S]+)/i);
  if (m) {
    const when = parseWhen(m[1], now);
    const cust = findCustomer(m[1], known);
    if (cust && when) return { reply: `Programo el mensaje para ${cust}.`, actions: [{ type: 'scheduled_message', customer: cust, text: m[2].trim(), when: localIso(when.date) }] };
  }

  // appointment
  if (/\b(cita|reunion|consulta|visita|turno|reserva)\b/.test(t) && /\b(agenda|programa|pon|crea|reserva|apunta|anota|a[nñ]ade|nueva)\b/.test(t)) {
    const when = parseWhen(raw, now);
    if (when) {
      const cust = findCustomer(raw, known);
      const kind = (t.match(/\b(cita|reunion|consulta|visita|turno|reserva)\b/)?.[1] ?? 'cita');
      const title = kind.charAt(0).toUpperCase() + kind.slice(1);
      const dur = t.match(/\b(\d{1,3}) ?(?:min|minutos)\b/) ? Number(t.match(/\b(\d{1,3}) ?(?:min|minutos)\b/)![1]) : /\buna hora\b|\b1 ?h\b/.test(t) ? 60 : 30;
      return { reply: cust ? `Agendo ${kind} con ${cust}.` : `Agendo la ${kind}${known.customers.length ? ' (sin cliente: dime el nombre si quieres vincularla)' : ''}.`, actions: [{ type: 'appointment', customer: cust, title: cust ? `${title} · ${cust}` : title, start: localIso(when.date), minutes: dur }] };
    }
  }

  // task / reminder
  m = raw.match(/(?:crea|a[ñn]ade|pon|nueva|apunta|an[oó]tame)\s+(?:una\s+)?(?:tarea|recordatorio)\s*[:\-–]?\s*([\s\S]+)/i) ?? raw.match(/recu[eé]rdame\s+([\s\S]+)/i);
  if (m) {
    const when = parseWhen(m[1], now);
    const title = stripWhen(m[1]).replace(/^(que|de|a)\s+/i, '') || m[1];
    const cust = findCustomer(m[1], known);
    return { reply: when ? 'Creo la tarea con su fecha.' : 'Creo la tarea (sin fecha).', actions: [{ type: 'task', title: title.charAt(0).toUpperCase() + title.slice(1), due: when ? localIso(when.date) : undefined, customer: cust }] };
  }

  // product
  m = raw.match(/(?:a[ñn]ade|crea|nuevo|nueva|sube|publica)\s+(?:un\s+|una\s+)?(?:producto|servicio|art[ií]culo)\s*[:\-–]?\s*([^\d€$]+?)\s*(?:a|por|de|cuesta|:)?\s*(\d+(?:[.,]\d{1,2})?)\s*(€|eur|euros|usd|\$|d[oó]lares)?/i);
  if (m) {
    const cur = /usd|\$|d[oó]lar/i.test(m[3] ?? '') ? 'USD' : 'EUR';
    return { reply: `Publico «${m[1].trim()}» en tu catálogo.`, actions: [{ type: 'product', name: m[1].trim().replace(/[,:]$/, ''), price: Number(m[2].replace(',', '.')), currency: cur }] };
  }

  // customer
  m = raw.match(/(?:a[ñn]ade|crea|nuevo|nueva|apunta|guarda)\s+(?:un\s+|una\s+)?cliente\s*[:\-–]?\s*([^,:\d]+?)(?:\s*[,:]?\s*(?:tel[eé]fono|tlf|m[oó]vil)?\s*(\+?\d[\d\s]{6,}))?\s*$/i);
  if (m && m[1].trim()) return { reply: `Añado a ${m[1].trim()} a tus clientes.`, actions: [{ type: 'customer', name: m[1].trim(), phone: m[2]?.trim() }] };

  // move a customer in the pipeline
  m = t.match(/\b(?:pasa|mueve|marca|pon)\b.*\b(?:a|como|en)\s+(?:etapa\s+)?(ganado|perdido|propuesta|en contacto|nuevo)\b/);
  if (m) {
    const cust = findCustomer(raw, known);
    if (cust) { const stage = { ganado: 'won', perdido: 'lost', propuesta: 'proposal', 'en contacto': 'contacted', nuevo: 'lead' }[m[1] as string]; return { reply: `Muevo a ${cust} a «${m[1]}».`, actions: [{ type: 'customer_update', customer: cust, stage }] }; }
  }

  // open a screen
  const screens: [RegExp, DoerAction['type'] extends never ? never : 'agenda' | 'clients' | 'catalog' | 'business' | 'inbox'][] = [[/\b(abre|ve a|ll[eé]vame|ens[eé][nñ]ame)\b.*\b(agenda|citas|calendario)\b/, 'agenda'], [/\b(abre|ve a|ll[eé]vame|ens[eé][nñ]ame)\b.*\b(clientes|crm)\b/, 'clients'], [/\b(abre|ve a|ll[eé]vame|ens[eé][nñ]ame)\b.*\b(cat[aá]logo|productos)\b/, 'catalog'], [/\b(abre|ve a|ll[eé]vame|ens[eé][nñ]ame)\b.*\b(bandeja|chats|mensajes)\b/, 'inbox'], [/\b(abre|ve a|ll[eé]vame|ens[eé][nñ]ame)\b.*\b(negocio|equipo|perfil)\b/, 'business']];
  for (const [re, screen] of screens) if (re.test(t)) return { reply: 'Voy.', actions: [{ type: 'open', screen }] };
  void after;
  return null;
}

export const SUGGESTIONS_I18N: Record<'en' | 'de', { icon: string; label: string; prompt: string }[]> = {
  en: [
    { icon: 'calendar', label: 'Book an appointment', prompt: 'Book an appointment tomorrow at 10' },
    { icon: 'flash', label: 'Quick reply', prompt: 'Create a quick reply hours: We are open Monday to Friday from 9 to 18' },
    { icon: 'hand-right', label: 'Welcome greeting', prompt: 'Set the greeting: Hi! Thanks for writing to us, how can we help?' },
    { icon: 'moon', label: 'Away message', prompt: 'Set the away message: We are closed now, we will answer first thing tomorrow.' },
    { icon: 'pricetags', label: 'Add product', prompt: 'Add a product Latte 2.5€' },
    { icon: 'checkbox', label: 'Create task', prompt: 'Create a task: call suppliers on Friday' },
    { icon: 'person-add', label: 'New customer', prompt: 'Add a customer Maria Lopez' },
  ],
  de: [
    { icon: 'calendar', label: 'Termin eintragen', prompt: 'Trage morgen um 10 einen Termin ein' },
    { icon: 'flash', label: 'Schnellantwort', prompt: 'Erstelle eine Schnellantwort zeiten: Wir haben Montag bis Freitag von 9 bis 18 Uhr geöffnet' },
    { icon: 'hand-right', label: 'Begrüßung', prompt: 'Setze die Begrüßung: Hallo! Danke für deine Nachricht, wie können wir helfen?' },
    { icon: 'moon', label: 'Abwesenheitsnachricht', prompt: 'Setze die Abwesenheit: Wir haben gerade geschlossen und antworten morgen früh.' },
    { icon: 'pricetags', label: 'Produkt hinzufügen', prompt: 'Füge ein Produkt Milchkaffee 2,5€ hinzu' },
    { icon: 'checkbox', label: 'Aufgabe anlegen', prompt: 'Erstelle eine Aufgabe: Lieferanten am Freitag anrufen' },
    { icon: 'person-add', label: 'Neuer Kunde', prompt: 'Füge einen Kunden Maria Lopez hinzu' },
  ],
};

export const SUGGESTIONS: { icon: string; label: string; prompt: string }[] = [
  { icon: 'calendar', label: 'Agendar una cita', prompt: 'Agenda una cita mañana a las 10' },
  { icon: 'flash', label: 'Respuesta rápida', prompt: 'Crea una respuesta rápida horario: Abrimos de lunes a viernes de 9 a 18 h' },
  { icon: 'hand-right', label: 'Saludo de bienvenida', prompt: 'Pon el saludo: ¡Hola! Gracias por escribirnos, ¿en qué podemos ayudarte?' },
  { icon: 'moon', label: 'Mensaje de ausencia', prompt: 'Pon la ausencia: Ahora estamos cerrados, te respondemos mañana a primera hora.' },
  { icon: 'pricetags', label: 'Añadir producto', prompt: 'Añade un producto Café con leche 2,5€' },
  { icon: 'checkbox', label: 'Crear tarea', prompt: 'Crea una tarea: llamar a proveedores el viernes' },
  { icon: 'person-add', label: 'Nuevo cliente', prompt: 'Añade un cliente María López' },
];
