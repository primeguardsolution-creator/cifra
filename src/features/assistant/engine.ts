// Deterministic, offline matcher for the CIFRA assistant. Pure TypeScript (no React) so it can be unit-tested in Node.
// Spanish is the source language (knowledge.ts); English and German come from packs.*.ts.
import { BotAction, COMMANDS, FALLBACK_TEXT, GREETING_TEXT, SHORT, STARTER_CHIPS, Topic, topicById, topics } from './knowledge';
import { Pack, packs } from './packs';

export type BotLocale = 'es' | 'en' | 'de';
export type Chip = { label: string; topic?: string; text?: string };
export type Reply = {
  text: string;
  actions?: BotAction[];
  chips?: Chip[];
  menu?: { title: string; chips: Chip[] }[];
  topicId?: string;
  /** high: clear answer · medium: best guess · none: nothing matched */
  confidence: 'high' | 'medium' | 'none';
};

export function normalize(s: string): string {
  return s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const ES_STOP = 'el la los las un una unos unas de del al a en y o u e que como cual cuales cuando donde quien por para con sin sobre mi mis tu tus su sus me te se le les lo es son soy eres ser esta estan estoy hay puedo puede pueden podria quiero quisiera necesito gustaria saber dime dimelo decir explicame explica ayudame ayuda favor hola buenas vale pues muy mas tambien ya si no ni pero porque tengo tiene hacer hago haga hacerlo cosa cosas app aplicacion cifra chat chats';

type Entry = { id: string; title: string; short: string; keywords: string[]; answer: string; actions?: BotAction[]; next?: string[] };
type Index = { entries: Entry[]; byId: Map<string, Entry>; stop: Set<string> };
const cache = new Map<BotLocale, Index>();

function index(l: BotLocale): Index {
  const hit = cache.get(l);
  if (hit) return hit;
  const pack: Pack | null = l === 'es' ? null : packs[l];
  const entries: Entry[] = topics.map((t: Topic) => {
    const p = pack?.topics[t.id];
    return { id: t.id, title: p?.title ?? t.title, short: p?.short ?? SHORT[t.id] ?? t.title, keywords: (p?.keywords ?? t.keywords).map(normalize), answer: p?.answer ?? t.answer, actions: t.actions, next: t.next };
  });
  const idx: Index = { entries, byId: new Map(entries.map((e) => [e.id, e])), stop: new Set(normalize(pack?.stop ?? ES_STOP).split(' ')) };
  cache.set(l, idx);
  return idx;
}

const tokens = (s: string, stop: Set<string>) => normalize(s).split(' ').filter((w) => w && !stop.has(w));

/** Two words are "the same" when they share a long enough prefix (handles plural/verb endings). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 4 || Math.abs(a.length - b.length) > 3) return false;
  let i = 0;
  while (i < min && a[i] === b[i]) i++;
  return i >= Math.min(5, min - 1) && i >= 4;
}

type Scored = { entry: Entry; score: number };

function score(ix: Index, query: string, qTokens: string[]): Scored[] {
  const padded = ` ${query} `;
  return ix.entries.map((entry) => {
    let s = 0;
    const used = new Set<number>(); // each word of the question can back at most one keyword per topic
    for (const k of entry.keywords) {
      const words = k.split(' ');
      if (words.length > 1) {
        if (padded.includes(` ${k} `) || padded.includes(` ${k}`)) s += 3 * words.length;
        else {
          // partial phrase: every content word of the phrase appears (in any order)
          const content = words.filter((w) => !ix.stop.has(w));
          if (content.length > 1 && content.every((w) => qTokens.some((t) => sameWord(t, w)))) s += 2 * content.length;
        }
      } else {
        const exact = qTokens.findIndex((t, i) => !used.has(i) && t === k);
        const near = exact >= 0 ? exact : qTokens.findIndex((t, i) => !used.has(i) && sameWord(t, k));
        if (near >= 0) { used.add(near); s += exact >= 0 ? 3 : 2; }
      }
    }
    const title = tokens(entry.title, ix.stop);
    if (title.length) s += 0.8 * title.filter((w) => qTokens.some((t) => sameWord(t, w))).length;
    return { entry, score: s };
  }).sort((a, b) => b.score - a.score);
}

const chipFor = (l: BotLocale, id: string): Chip => ({ label: index(l).byId.get(id)?.short ?? id, topic: id });
const SEE_ALL: Record<BotLocale, string> = { es: 'Ver todos los temas', en: 'See all topics', de: 'Alle Themen ansehen' };

export function topicReply(id: string, confidence: Reply['confidence'] = 'high', prefix = '', l: BotLocale = 'es'): Reply {
  const e = index(l).byId.get(id)!;
  const taken = new Set((e.actions ?? []).map((x) => x.label));
  return { text: prefix + e.answer, actions: e.actions, chips: (e.next ?? []).filter((n) => index(l).byId.has(n)).map((n) => chipFor(l, n)).filter((c) => !taken.has(c.label)), topicId: id, confidence };
}

/** Commands as the user's language shows them (Spanish ones keep working in every language). */
export function commandList(l: BotLocale = 'es') {
  const pack = l === 'es' ? null : packs[l];
  return COMMANDS.map((c) => ({ cmd: pack?.commandAliases[c.cmd] ?? c.cmd, es: c.cmd, hint: pack?.commandHints[c.cmd] ?? c.hint, topic: c.topic }));
}

export function helpMenu(l: BotLocale = 'es'): Reply {
  const pack = l === 'es' ? null : packs[l];
  const sec = (title: string, ids: string[]) => ({ title: pack?.menu[title] ?? title, chips: ids.map((i) => chipFor(l, i)) });
  const head = pack?.help ?? '**Todo lo que sé** 📚\nToca un tema o escríbeme tu duda con tus palabras. Atajos: ';
  return {
    text: head + commandList(l).slice(0, 6).map((c) => `\`${c.cmd}\``).join(' ') + ' …',
    menu: [
      sec('Mensajes', ['newchat', 'messages', 'ticks', 'media', 'voice', 'schedule', 'organize', 'search', 'starred']),
      sec('Llamadas y gente', ['calls', 'groups', 'statuses', 'contacts', 'notfound', 'invite']),
      sec('Cuenta y privacidad', ['register', 'account', 'profile', 'username', 'privacy', 'security', 'block', 'notifications']),
      sec('Business', ['business', 'bizcreate', 'agenda', 'crm', 'doer', 'bizprofile', 'bizphone', 'inbox', 'team', 'quick', 'auto', 'catalog']),
      sec('Más', ['install', 'customize', 'wallpaper', 'profileview', 'video', 'multidevice', 'troubleshoot', 'limits', 'about']),
    ],
    confidence: 'high',
  };
}

export function greeting(name?: string | null, l: BotLocale = 'es'): Reply {
  const first = (name ?? '').trim().split(/\s+/)[0];
  const tpl = l === 'es' ? GREETING_TEXT : packs[l].greeting;
  return { text: tpl.replace('{name}', first ? (l === 'es' ? `, ${first}` : l === 'de' ? ` ${first}` : ` ${first}`) : ''), chips: STARTER_CHIPS.map((i) => chipFor(l, i)), confidence: 'high' };
}

const ES_SMALL = {
  greet: /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|hi|hello|que tal|saludos|ola)( .*)?$/,
  thanks: /^(gracias|muchas gracias|mil gracias|genial|perfecto|vale gracias|ok gracias|te lo agradezco|thanks|thank you|super|guay|estupendo|excelente)( .*)?$/,
  bye: /^(adios|hasta luego|chao|bye|nos vemos|hasta pronto)( .*)?$/,
  human: /(hablar con (un|una) (humano|persona|agente)|soporte humano|persona real|atencion humana|hablar con alguien de cifra|contactar (con )?(cifra|soporte))/,
  feedback: /^(sugerencia|tengo una sugerencia|quiero sugerir|propongo|feedback|reportar|reportar un error|informar de un error)( .*)?$/,
};
const ES_REPLIES = {
  thanks: '¡A ti! 😊 Si te surge otra duda, aquí estoy.',
  bye: '¡Hasta pronto! 👋 Cuando me necesites, búscame como **@maestro**.',
  human: 'Soy un **bot** y ahora mismo es el único canal de ayuda dentro de la app: todavía no hay soporte humano. Cuéntame tu problema con detalle y haré lo posible por resolverlo; para sugerencias o errores graves, dime «sugerencia» y te explico qué datos conviene anotar.',
  feedback: '¡Gracias por ayudarnos a mejorar! 🙌 Aún no hay un buzón dentro de la app, pero apunta **qué hacías**, **qué esperabas** y **qué pasó** (y una captura si puedes) y compártelo con quien te dio acceso a CIFRA. Todo cuenta para decidir qué construir primero.',
};

export function respond(input: string, name?: string | null, l: BotLocale = 'es'): Reply {
  const pack = l === 'es' ? null : packs[l];
  const ix = index(l);
  const raw = input.trim();
  const q = normalize(raw);
  if (!q) return greeting(name, l);

  if (q.startsWith('/')) {
    const cmd = q.split(' ')[0];
    if (cmd === '/start') return greeting(name, l);
    if (['/ayuda', '/help', '/temas', '/hilfe', '/themen'].includes(cmd)) return helpMenu(l);
    const hit = commandList(l).find((c) => normalize(c.cmd) === cmd || c.es === cmd);
    if (hit?.topic) return topicReply(hit.topic, 'high', '', l);
    const text = pack ? pack.unknownCommand.replace('{cmd}', cmd) : `No conozco el comando \`${cmd}\`. Escribe \`/ayuda\` para ver todo lo que puedo hacer.`;
    return { text, chips: [{ label: SEE_ALL[l], text: '/ayuda' }], confidence: 'none' };
  }

  const bare = q.replace(/^maestro\s+/, '');
  const sm = pack?.small ?? ES_SMALL;
  const rp = pack?.smallReplies ?? ES_REPLIES;
  if (sm.greet.test(bare)) return greeting(name, l);
  if (sm.thanks.test(bare)) return { text: rp.thanks, chips: ['start', 'limits'].map((i) => chipFor(l, i)), confidence: 'high' };
  if (sm.bye.test(bare)) return { text: rp.bye, confidence: 'high' };
  if (sm.human.test(bare)) return { text: rp.human, chips: ['troubleshoot', 'limits'].map((i) => chipFor(l, i)), confidence: 'high' };
  if (sm.feedback.test(bare)) return { text: rp.feedback, chips: ['limits', 'troubleshoot'].map((i) => chipFor(l, i)), confidence: 'high' };

  const qTokens = tokens(raw, ix.stop);
  const ranked = score(ix, bare, qTokens);
  const [top, second] = ranked;
  if (top && top.score >= 5 && top.score >= (second?.score ?? 0) * 1.25) return topicReply(top.entry.id, 'high', '', l);
  if (top && top.score >= 2) {
    const close = ranked.filter((r) => r.score >= top.score * 0.6 && r.score >= 2).slice(0, 3);
    // Only hedge ("creo que preguntas por…") when the match is weak or a runner-up is nearly as good.
    const unsure = top.score < 3 || (second ? second.score >= top.score * 0.8 : false);
    const prefix = unsure ? (pack ? pack.hedge.replace('{title}', top.entry.title) : `Creo que preguntas por **${top.entry.title}**:\n\n`) : '';
    const r = topicReply(top.entry.id, unsure ? 'medium' : 'high', prefix, l);
    if (close.length > 1) r.chips = [...close.slice(1).map((x) => chipFor(l, x.entry.id)), ...(r.chips ?? []).filter((c) => !close.some((x) => x.entry.id === c.topic))].slice(0, 5);
    return r;
  }
  return { text: pack?.fallback ?? FALLBACK_TEXT, chips: [...STARTER_CHIPS.map((i) => chipFor(l, i)), { label: SEE_ALL[l], text: '/ayuda' }], confidence: 'none' };
}

/** Command suggestions shown while the user types "/". */
export function commandSuggestions(prefix: string, l: BotLocale = 'es') {
  const p = normalize(prefix);
  return commandList(l).filter((c) => normalize(c.cmd).startsWith(p || '/') || c.es.startsWith(p || '/'));
}
