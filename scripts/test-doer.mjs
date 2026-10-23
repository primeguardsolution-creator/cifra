// Offline check of Doer's interpreter: Spanish requests → typed actions (dates resolved against a fixed "now").
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const out = mkdtempSync(join(tmpdir(), 'doer-'));
for (const f of ['actions', 'parse']) {
  const src = readFileSync(fileURLToPath(new URL(`../src/features/doer/${f}.ts`, import.meta.url)), 'utf8');
  writeFileSync(join(out, `${f}.mjs`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '\.\/(\w+)'/g, "from './$1.mjs'"));
}
const { interpret, parseWhen, localIso } = await import(pathToFileURL(join(out, 'actions.mjs')).href);

const now = new Date(2026, 9, 22, 12, 0); // Thursday 22 Oct 2026, 12:00
const known = { customers: ['Ana Pérez', 'Luis Gómez', 'María López'] };
let failed = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${label}${ok ? '' : ` ${extra}`}`); if (!ok) failed++; };
const when = (s) => { const w = parseWhen(s, now); return w ? localIso(w.date) : null; };

check('mañana a las 10', when('mañana a las 10') === '2026-10-23T10:00');
check('pasado mañana 17:30', when('pasado mañana a las 17:30') === '2026-10-24T17:30');
check('el lunes (próximo)', when('el lunes a las 9') === '2026-10-26T09:00');
check('el jueves es el de la semana que viene', when('el jueves a las 9') === '2026-10-29T09:00');
check('15 de noviembre a las 9', when('el 15 de noviembre a las 9') === '2026-11-15T09:00');
check('a las 5 → 17:00 (cita)', when('hoy a las 5') === '2026-10-22T17:00');
check('a las 8 de la mañana', when('mañana a las 8 de la mañana') === '2026-10-23T08:00');
check('en 2 horas', when('en 2 horas') === '2026-10-22T14:00');
check('sin fecha → null', parseWhen('hola qué tal', now) === null);

const a = (s) => interpret(s, known, now)?.actions?.[0];
let x = a('Agenda una cita con Ana mañana a las 10');
check('cita con cliente conocido', x?.type === 'appointment' && x.customer === 'Ana Pérez' && x.start === '2026-10-23T10:00' && x.minutes === 30, JSON.stringify(x));
x = a('programa una reunión el viernes a las 16:30 de 60 minutos');
check('reunión con duración', x?.type === 'appointment' && x.start === '2026-10-23T16:30' && x.minutes === 60, JSON.stringify(x));
x = a('Crea una respuesta rápida horario: Abrimos de 9 a 18 h');
check('respuesta rápida', x?.type === 'quick_reply' && x.shortcut === 'horario' && /Abrimos/.test(x.body), JSON.stringify(x));
x = a('Pon el saludo: ¡Hola! ¿En qué te ayudo?');
check('saludo', x?.type === 'greeting' && /En qué/.test(x.text), JSON.stringify(x));
x = a('Pon la ausencia: Volvemos el lunes');
check('ausencia con texto', x?.type === 'away' && x.enabled && x.text === 'Volvemos el lunes', JSON.stringify(x));
x = a('desactiva la ausencia');
check('apagar ausencia', x?.type === 'away' && x.enabled === false, JSON.stringify(x));
x = a('Crea una tarea: llamar a proveedores el viernes');
check('tarea con fecha', x?.type === 'task' && /llamar a proveedores/i.test(x.title) && x.due?.startsWith('2026-10-23'), JSON.stringify(x));
x = a('recuérdame enviar presupuesto a Luis mañana');
check('recordatorio vinculado', x?.type === 'task' && x.customer === 'Luis Gómez' && x.due?.startsWith('2026-10-23'), JSON.stringify(x));
x = a('Añade un producto Café con leche 2,5€');
check('producto con precio', x?.type === 'product' && x.name === 'Café con leche' && x.price === 2.5 && x.currency === 'EUR', JSON.stringify(x));
x = a('añade un cliente Pedro Ruiz');
check('cliente nuevo', x?.type === 'customer' && x.name === 'Pedro Ruiz', JSON.stringify(x));
x = a('mueve a María López a ganado');
check('mover en el embudo', x?.type === 'customer_update' && x.customer === 'María López' && x.stage === 'won', JSON.stringify(x));
x = a('envía a Ana mañana a las 9: tu pedido está listo');
check('mensaje programado', x?.type === 'scheduled_message' && x.customer === 'Ana Pérez' && x.when === '2026-10-23T09:00' && /pedido/.test(x.text), JSON.stringify(x));
x = a('abre la agenda');
check('abrir pantalla', x?.type === 'open' && x.screen === 'agenda', JSON.stringify(x));
check('algo ambiguo → null (lo resuelve la IA)', interpret('ayúdame a mejorar mis ventas', known, now) === null);
check('texto vacío → null', interpret('   ', known, now) === null);

// ── English and German ──
const en = (s) => interpret(s, known, now, 'en')?.actions?.[0];
const de = (s) => interpret(s, known, now, 'de')?.actions?.[0];
const ok = (label, v) => check(label, v);
let y = en('Book an appointment with Ana tomorrow at 10'); ok('EN cita', y?.type === 'appointment' && y.customer === 'Ana Pérez' && y.start === '2026-10-23T10:00');
y = en('schedule a meeting on Friday at 4:30 pm for 60 minutes'); ok('EN reunión', y?.type === 'appointment' && y.start === '2026-10-23T16:30' && y.minutes === 60);
y = en('Create a quick reply hours: We open 9 to 18'); ok('EN respuesta rápida', y?.type === 'quick_reply' && y.shortcut === 'hours' && /We open/.test(y.body));
y = en('Set the greeting: Hi there!'); ok('EN saludo', y?.type === 'greeting' && y.text === 'Hi there!');
y = en('Set the away message: Back on Monday'); ok('EN ausencia', y?.type === 'away' && y.enabled && y.text === 'Back on Monday');
y = en('turn off the away message'); ok('EN apagar ausencia', y?.type === 'away' && y.enabled === false);
y = en('Create a task: call suppliers on Friday'); ok('EN tarea', y?.type === 'task' && /call suppliers/i.test(y.title) && y.due?.startsWith('2026-10-23'));
y = en('remind me to send the quote to Luis tomorrow'); ok('EN recordatorio', y?.type === 'task' && y.customer === 'Luis Gómez' && y.due?.startsWith('2026-10-23'));
y = en('Add a product Latte for 2.5 euros'); ok('EN producto', y?.type === 'product' && y.name === 'Latte' && y.price === 2.5 && y.currency === 'EUR');
y = en('add a customer Pedro Ruiz'); ok('EN cliente', y?.type === 'customer' && y.name === 'Pedro Ruiz');
y = en('move Maria Lopez to won'); ok('EN embudo', y?.type === 'customer_update' && y.customer === 'María López' && y.stage === 'won');
y = en('message Ana tomorrow at 9: your order is ready'); ok('EN mensaje programado', y?.type === 'scheduled_message' && y.customer === 'Ana Pérez' && y.when === '2026-10-23T09:00');
y = en('open the calendar'); ok('EN abrir', y?.type === 'open' && y.screen === 'agenda');
ok('EN ambiguo → null', interpret('help me improve my sales', known, now, 'en') === null);
y = de('Trage morgen um 10 einen Termin mit Ana ein'); ok('DE cita', y?.type === 'appointment' && y.customer === 'Ana Pérez' && y.start === '2026-10-23T10:00');
y = de('Vereinbare eine Besprechung am Freitag um 16:30 für 60 Minuten'); ok('DE reunión', y?.type === 'appointment' && y.start === '2026-10-23T16:30' && y.minutes === 60);
y = de('Erstelle eine Schnellantwort zeiten: Wir öffnen von 9 bis 18'); ok('DE respuesta rápida', y?.type === 'quick_reply' && y.shortcut === 'zeiten' && /öffnen/.test(y.body));
y = de('Setze die Begrüßung: Hallo zusammen!'); ok('DE saludo', y?.type === 'greeting' && y.text === 'Hallo zusammen!');
y = de('Setze die Abwesenheit: Wir sind ab Montag zurück'); ok('DE ausencia', y?.type === 'away' && y.enabled && /Montag/.test(y.text));
y = de('deaktiviere die Abwesenheit'); ok('DE apagar ausencia', y?.type === 'away' && y.enabled === false);
y = de('Erstelle eine Aufgabe: Lieferanten anrufen am Freitag'); ok('DE tarea', y?.type === 'task' && /Lieferanten anrufen/i.test(y.title) && y.due?.startsWith('2026-10-23'));
y = de('Füge ein Produkt Milchkaffee 2,5€ hinzu'); ok('DE producto', y?.type === 'product' && /Milchkaffee/.test(y.name) && y.price === 2.5);
y = de('Füge einen Kunden Pedro Ruiz hinzu'); ok('DE cliente', y?.type === 'customer' && /Pedro Ruiz/.test(y.name));
y = de('Schreibe an Ana morgen um 9: Deine Bestellung ist fertig'); ok('DE mensaje programado', y?.type === 'scheduled_message' && y.customer === 'Ana Pérez' && y.when === '2026-10-23T09:00');
y = de('Öffne den Kalender'); ok('DE abrir', y?.type === 'open' && y.screen === 'agenda');
ok('DE ambiguo → null', interpret('hilf mir meine Verkäufe zu verbessern', known, now, 'de') === null);

console.log(failed ? `\n${failed} fallidas` : '\ntodo correcto');
process.exit(failed ? 1 : 0);
