// Offline check of the assistant matcher: every question must land on the expected topic (or at least list it as a suggestion).
// Run: npm run test:assistant
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../src/features/assistant/', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'assistant-'));
for (const f of ['knowledge', 'packs', 'packs.en', 'packs.de', 'engine']) {
  const src = readFileSync(join(root, `${f}.ts`), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '\.\/([\w.]+)'/g, "from './$1.mjs'");
  writeFileSync(join(out, `${f}.mjs`), js);
}
const { respond } = await import(pathToFileURL(join(out, 'engine.mjs')).href);
const { topics } = await import(pathToFileURL(join(out, 'knowledge.mjs')).href);

let okLoc = 0; const badLoc = [];
const cases = [
  ['hola', 'greeting'], ['buenas tardes', 'greeting'], ['gracias', 'thanks'],
  ['¿Cómo empiezo a usar la app?', 'start'], ['para qué sirve cifra', 'start'], ['primeros pasos', 'start'],
  ['no puedo registrarme', 'register'], ['olvidé mi contraseña', 'register'], ['puedo tener dos cuentas con el mismo número', 'register'],
  ['cómo hablo con un amigo nuevo', 'newchat'], ['quiero buscar a una persona por su número', 'newchat'], ['cómo añado un contacto', 'newchat'],
  ['cómo pongo mi @usuario', 'username'], ['quiero ocultar mi número de teléfono', 'username'], ['que no me encuentren por mi número', 'username'],
  ['cómo cambio mi foto de perfil', 'profile'], ['cambiar mi nombre', 'profile'],
  ['cómo borro un mensaje que envié', 'messages'], ['cómo edito un mensaje', 'messages'], ['como reacciono con un emoji', 'messages'], ['responder a un mensaje concreto', 'messages'],
  ['cómo envío una foto', 'media'], ['quiero mandar un pdf', 'media'], ['qué tamaño máximo tienen los archivos', 'media'],
  ['cómo mando un audio', 'voice'], ['mensaje de voz', 'voice'], ['no me deja grabar el micrófono', 'voice'],
  ['cómo llamo por wifi', 'calls'], ['quiero hacer una videollamada', 'calls'], ['no suena cuando me llaman', 'calls'], ['dónde veo las llamadas perdidas', 'calls'],
  ['cómo creo un grupo', 'groups'], ['quiero salir de un grupo', 'groups'],
  ['cómo subo un estado', 'statuses'], ['cuánto duran las historias', 'statuses'],
  ['quiero un chat que se autodestruya', 'incognito'], ['cómo abro un chat incógnito', 'incognito'], ['chat secreto en blanco y negro', 'incognito'],
  ['cómo publico un vídeo de mi negocio', 'posts'], ['dónde se ven las publicaciones del negocio', 'posts'],
  ['me escribe un desconocido, qué hago', 'report'], ['cómo denuncio spam', 'report'],
  ['borrar un contacto', 'contacts'],
  ['cómo fijo un chat arriba', 'organize'], ['quiero archivar una conversación', 'organize'], ['cómo silencio un chat', 'organize'],
  ['cómo busco un mensaje antiguo', 'search'], ['buscar en todos los chats', 'search'],
  ['dónde están mis mensajes destacados', 'starred'], ['cómo destaco un mensaje', 'starred'],
  ['cómo programo un mensaje', 'schedule'], ['quiero enviar un mensaje más tarde', 'schedule'], ['felicitar a alguien a las 00:00', 'schedule'],
  ['cómo cambio el color de la app', 'customize'], ['modo oscuro', 'customize'], ['cambiar el fondo de los chats', 'wallpaper'],
  ['cómo pongo un pin a la app', 'security'], ['quiero bloquear la app con un código', 'security'],
  ['cómo bloqueo a una persona', 'block'], ['alguien me molesta', 'block'],
  ['es seguro, está cifrado', 'privacy'], ['tiene cifrado de extremo a extremo', 'privacy'], ['quién puede leer mis mensajes', 'privacy'],
  ['cómo instalo cifra en el móvil', 'install'], ['dónde descargo la app', 'install'], ['cómo la añado a la pantalla de inicio', 'install'],
  ['no me llegan las notificaciones', 'notifications'], ['avisos de mensajes nuevos', 'notifications'],
  ['qué es business', 'business'], ['cómo cambio de personal a business', 'business'], ['tengo una tienda y quiero usar la app', 'business'],
  ['cómo creo mi negocio', 'bizcreate'], ['crear otro negocio', 'bizcreate'],
  ['cómo me encuentran mis clientes', 'bizprofile'], ['enlace para compartir mi negocio', 'bizprofile'],
  ['cómo asigno una conversación a un compañero', 'inbox'], ['qué es una nota interna', 'inbox'], ['bandeja de clientes', 'inbox'],
  ['cómo añado empleados', 'team'], ['qué roles hay en el equipo', 'team'],
  ['respuestas rápidas', 'quick'], ['guardar plantillas para responder', 'quick'],
  ['mensaje de bienvenida automático', 'auto'], ['mensaje de ausencia fuera de horario', 'auto'],
  ['cómo publico productos con precio', 'catalog'], ['catálogo', 'catalog'],
  ['puedo usarla en el ordenador', 'multidevice'], ['cambié de móvil, qué pasa con mis chats', 'multidevice'],
  ['cómo invito a un amigo', 'invite'], ['mi amigo no tiene cifra', 'invite'],
  ['no se envían mis mensajes', 'troubleshoot'], ['la app no funciona', 'troubleshoot'], ['sale error', 'troubleshoot'],
  ['qué le falta a cifra', 'limits'], ['tiene encuestas', 'limits'], ['hay llamadas de grupo', 'limits'],
  ['quién eres', 'about'], ['eres un bot', 'about'],
  ['/start', 'greeting'], ['/llamadas', 'calls'], ['/negocio', 'business'], ['/privacidad', 'privacy'],
  // Colloquial phrasings that were NOT used to write the keywords (held-out set)
  ['quiero mandarle algo a mi novia mañana a las 8', 'schedule'], ['mi mamá no sabe usar esto, cómo le explico', 'start'], ['se me cayó la llamada', 'calls'], ['no veo la cámara en la videollamada', 'calls'],
  ['por qué no me suena el teléfono cuando me llaman', 'calls'], ['cómo hago para que nadie vea mi teléfono', 'username'], ['puedo cambiar mi apodo', 'profile'], ['puedo escribir sin gastar datos', 'troubleshoot'],
  ['cómo elimino una conversación', 'organize'], ['se puede recuperar un mensaje borrado', 'messages'], ['mandar una nota de audio', 'voice'], ['subir una imagen', 'media'],
  ['cómo abro un negocio en cifra', 'bizcreate'], ['quiero que mis empleados contesten a los clientes', 'team'], ['cómo configuro el horario de mi negocio', 'auto'], ['qué hago si mi cliente pregunta siempre lo mismo', 'quick'],
  ['vender cosas en la app', 'catalog'], ['mis mensajes los puede leer alguien de la empresa', 'privacy'], ['me han hackeado', 'account'], ['cómo ocultar la app con un código', 'security'],
  ['se puede usar sin internet', 'troubleshoot'], ['hay versión para iphone', 'install'], ['funciona en android', 'install'], ['cómo cierro sesión', 'account'], ['cómo borro mi cuenta', 'account'],
  ['cómo cambio mi contraseña', 'account'], ['cómo silenciar un grupo', 'organize'], ['cuántos chats puedo fijar', 'organize'], ['cuánto pesa el archivo máximo', 'media'], ['puedo poner una foto de fondo', 'wallpaper'],
  ['quiero que se vea más oscuro', 'customize'], ['qué significa la doble palomita', 'ticks'], ['dónde veo mis estados', 'statuses'], ['cómo agrego a mi hermana', 'newchat'], ['mi amiga no me aparece', 'notfound'],
  ['no encuentro a mi primo en la búsqueda', 'notfound'],
  // v3: agenda, CRM, Doer, profiles, video, wallpapers
  ['cómo agendo una cita con un cliente', 'agenda'], ['mis clientes pueden pedir cita', 'agenda'], ['dónde está el calendario del negocio', 'agenda'], ['cómo reprogramo una cita', 'agenda'],
  ['cómo llevo el seguimiento de mis clientes', 'crm'], ['qué es el embudo de ventas', 'crm'], ['cómo pongo etiquetas a un cliente', 'crm'], ['cómo creo una tarea pendiente', 'crm'],
  ['qué es doer', 'doer'], ['hay un asistente que haga las cosas por mí en el negocio', 'doer'], ['cómo le pido algo a doer', 'doer'],
  ['cómo oculto el teléfono de mi negocio', 'bizphone'], ['quiero que solo me escriban por cifra sin dar mi número del negocio', 'bizphone'],
  ['cómo veo el perfil de mi contacto', 'profileview'], ['dónde veo desde cuándo está alguien en cifra', 'profileview'],
  ['se pueden ver vídeos dentro de la app', 'video'], ['cómo cambio la velocidad del vídeo', 'video'],
  ['cómo pongo mi foto de fondo en los chats', 'wallpaper'], ['qué fondos de chat hay', 'wallpaper'],
  ['cómo busco un negocio con su arroba', 'newchat'],
];


// ── English and German: same topics, questions written the way people actually ask ──
const casesEn = [
  ['hello', 'greeting'], ['how do I get started', 'start'], ['how do I schedule a message for tomorrow', 'schedule'], ['I forgot my password', 'register'], ['how do I call someone over wifi', 'calls'],
  ['my calls do not ring', 'calls'], ['how can I hide my phone number', 'username'], ['how do I change my profile picture', 'profile'], ['how do I delete a message I sent', 'messages'],
  ['how do I send a photo', 'media'], ['how do I record a voice message', 'voice'], ['how do I create a group', 'groups'], ['how long do statuses last', 'statuses'],
  ['how do I open an incognito chat that self-destructs', 'incognito'], ['how do I publish a video for my business', 'posts'], ['a stranger wrote to me, how do I report spam', 'report'],
  ['how do I pin a chat', 'organize'], ['how do I search an old message', 'search'], ['is it end to end encrypted', 'privacy'], ['how do I install it on my iphone', 'install'],
  ['I am not getting notifications', 'notifications'], ['what is business', 'business'], ['how do I create my business', 'bizcreate'], ['how do customers book an appointment', 'agenda'],
  ['how do I track my customers', 'crm'], ['what is doer', 'doer'], ['how do I add employees to my team', 'team'], ['how do I set up quick replies', 'quick'],
  ['how do I add products with prices', 'catalog'], ['how do I log out', 'account'], ['I cannot find my friend in the search', 'notfound'], ['what do the double ticks mean', 'ticks'],
  ['can I watch videos inside the app', 'video'], ['how do I change the chat background', 'wallpaper'], ['who are you', 'about'], ['how do I block someone', 'block'],
  ['/help', 'menu'], ['/calls', 'calls'], ['thanks', 'thanks'],
];
const casesDe = [
  ['hallo', 'greeting'], ['wie fange ich an', 'start'], ['wie plane ich eine nachricht für morgen', 'schedule'], ['ich habe mein passwort vergessen', 'register'], ['wie rufe ich jemanden per wlan an', 'calls'],
  ['mein anruf klingelt nicht', 'calls'], ['wie verberge ich meine telefonnummer', 'username'], ['wie ändere ich mein profilbild', 'profile'], ['wie lösche ich eine gesendete nachricht', 'messages'],
  ['wie sende ich ein foto', 'media'], ['wie nehme ich eine sprachnachricht auf', 'voice'], ['wie erstelle ich eine gruppe', 'groups'], ['wie lange dauern status', 'statuses'],
  ['wie öffne ich einen inkognito chat der sich selbst zerstört', 'incognito'], ['wie veröffentliche ich ein video für mein unternehmen', 'posts'], ['ein unbekannter schreibt mir, wie melde ich spam', 'report'],
  ['wie hefte ich einen chat an', 'organize'], ['wie suche ich eine alte nachricht', 'search'], ['ist es ende zu ende verschlüsselt', 'privacy'], ['wie installiere ich es auf dem iphone', 'install'],
  ['ich bekomme keine benachrichtigungen', 'notifications'], ['was ist business', 'business'], ['wie erstelle ich mein unternehmen', 'bizcreate'], ['wie buchen kunden einen termin', 'agenda'],
  ['wie verwalte ich meine kunden', 'crm'], ['was ist doer', 'doer'], ['wie füge ich mitarbeiter zum team hinzu', 'team'], ['wie richte ich schnellantworten ein', 'quick'],
  ['wie füge ich produkte mit preisen hinzu', 'catalog'], ['wie melde ich mich ab', 'account'], ['ich finde meinen freund in der suche nicht', 'notfound'], ['was bedeuten die doppelten häkchen', 'ticks'],
  ['kann ich videos in der app ansehen', 'video'], ['wie ändere ich den chat hintergrund', 'wallpaper'], ['wer bist du', 'about'], ['wie blockiere ich jemanden', 'block'],
  ['/hilfe', 'menu'], ['/anrufe', 'calls'], ['danke', 'thanks'],
];
for (const [loc, list] of [['en', casesEn], ['de', casesDe]]) {
  for (const [q, want] of list) {
    const r = respond(q, 'Ana', loc);
    const got = r.topicId ?? (r.menu ? 'menu' : /Hi |Hallo /.test(r.text) && /Maestro/.test(r.text) ? 'greeting' : /(You got it|Gern geschehen)/.test(r.text) ? 'thanks' : 'none');
    const suggested = (r.chips ?? []).some((c) => c.topic === want);
    if (got === want) { okLoc++; } else badLoc.push(`✗ [${loc}] "${q}" → ${got}, esperado ${want}${suggested ? ' (sugerido)' : ''}`);
  }
}
for (const [loc, offs] of [['en', ['i want pizza with pineapple', 'what is the capital of france', 'tell me a joke']], ['de', ['ich möchte pizza mit ananas', 'was ist die hauptstadt von frankreich', 'erzähl mir einen witz']]]) {
  for (const off of offs) if (respond(off, 'Ana', loc).confidence !== 'none') { badLoc.push(`✗ [${loc}] fuera de tema debería dar «no estoy seguro»: "${off}"`); }
}
let ok = 0; const bad = [];
for (const [q, want] of cases) {
  const r = respond(q, 'Ana');
  let got = r.topicId ?? (r.menu ? 'menu' : /Hola|Soy \*\*Maestro/.test(r.text) ? 'greeting' : /A ti!/.test(r.text) ? 'thanks' : 'none');
  const suggested = (r.chips ?? []).some((c) => c.topic === want);
  if (got === want || (suggested && r.confidence !== 'high' && !['greeting', 'thanks'].includes(want))) { ok++; if (got !== want) console.log(`~ "${q}" → ${got} (suggests ${want})`); } else bad.push(`✗ "${q}" → ${got}, esperado ${want}`);
}
bad.forEach((b) => console.log(b));
badLoc.forEach((b) => console.log(b));
console.log(`EN/DE: ${okLoc}/${casesEn.length + casesDe.length} correctas`);
if (badLoc.length) process.exitCode = 1;
console.log(`\n${ok}/${cases.length} correctas · ${topics.length} temas`);

for (const off of ['quiero pizza con piña', 'cuál es la capital de francia', 'quién ganó el mundial', 'asdfgh', 'dime un chiste']) {
  if (respond(off).confidence !== 'none') { console.log(`✗ fuera de tema debería dar «no estoy seguro»: "${off}"`); process.exitCode = 1; }
}
if (bad.length) process.exitCode = 1;
