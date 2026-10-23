// Exercises netlify/functions/doer.mts against local mocks of Supabase and the Anthropic API (no key, no cost).
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const proj = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'doer-fn-'));
mkdirSync(join(out, 'netlify/functions'), { recursive: true });
symlinkSync(join(proj, 'node_modules'), join(out, 'node_modules'));
writeFileSync(join(out, 'netlify/functions/doer.mjs'), ts.transpileModule(readFileSync(join(proj, 'netlify/functions/doer.mts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);

let reply = { reply: 'Agendo la cita.', actions: [] };
let rateLimited = false;
const seen = { body: null, headers: null };
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url.startsWith('/auth/v1/user')) return send(200, { id: 'u1' });
    if (req.url.startsWith('/rest/v1/rpc/check_assistant_rate')) return rateLimited ? send(400, { message: 'rate_limited' }) : send(200, null);
    if (req.url.startsWith('/v1/messages')) {
      seen.body = JSON.parse(body); seen.headers = req.headers;
      return send(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: JSON.stringify(reply) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 } });
    }
    send(404, {});
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const env = { SUPABASE_URL: base, SUPABASE_PUBLISHABLE_KEY: 'pk', ANTHROPIC_API_KEY: 'sk-test' };
globalThis.Netlify = { env: { get: (k) => env[k] } };
process.env.ANTHROPIC_BASE_URL = base;
const handler = (await import(pathToFileURL(join(out, 'netlify/functions/doer.mjs')).href)).default;

let failed = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${label}${ok ? '' : ` ${extra}`}`); if (!ok) failed++; };
const nulls = { shortcut: null, body: null, text: null, enabled: null, customer: null, title: null, start: null, minutes: null, due: null, name: null, price: null, currency: null, description: null, phone: null, stage: null, tag: null, note: null, when: null, screen: null };
const call = (over = {}) => handler(new Request('http://x/api/doer', { method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'agenda a Ana mañana' }], context: { now: 'Thu Oct 22 2026 12:00', nowIso: '2026-10-22T12:00', businessName: 'Peluquería Sol', customers: ['Ana Pérez', 'Luis Gómez'] }, ...over }) }));

reply = { reply: 'Agendo la cita con Ana.', actions: [{ ...nulls, type: 'appointment', title: 'Corte', start: '2026-10-23T10:00', minutes: 30, customer: 'Ana Pérez' }, { ...nulls, type: 'hack_database' }] };
let r = await call(); let j = await r.json();
check('200 con el plan; descarta tipos inventados y quita los null', r.status === 200 && j.actions.length === 1 && j.actions[0].type === 'appointment' && j.actions[0].customer === 'Ana Pérez' && !('shortcut' in j.actions[0]), JSON.stringify(j));
check('pide JSON con esquema estricto y effort bajo, sin parámetros prohibidos', seen.body.output_config?.format?.type === 'json_schema' && seen.body.output_config.format.schema.additionalProperties === false && seen.body.output_config.effort === 'low' && !('temperature' in seen.body) && !('thinking' in seen.body), JSON.stringify(seen.body.output_config)?.slice(0, 200));
check('usa claude-opus-5-5 con fallback por defecto', seen.body.model === 'claude-opus-5-5' && seen.body.fallbacks === 'default' && /server-side-fallback-2026-07-01/.test(seen.headers['anthropic-beta'] ?? ''));
const sys = seen.body.system.map((b) => b.text).join('\n');
check('el contexto lleva fecha local, negocio y clientes; las reglas, cache', /2026-10-22T12:00/.test(sys) && /Peluquería Sol/.test(sys) && /Ana Pérez \| Luis Gómez/.test(sys) && seen.body.system[0].cache_control?.type === 'ephemeral');
check('el prompt prohíbe acciones destructivas', /No hagas nada destructivo/.test(sys));
r = await handler(new Request('http://x/api/doer', { method: 'POST', body: '{}' }));
check('sin sesión → 401', r.status === 401);
r = await call({ messages: [{ role: 'assistant', content: 'x' }] });
check('sin pregunta del usuario → 400', r.status === 400);
rateLimited = true; r = await call(); rateLimited = false;
check('límite excedido → 429', r.status === 429);
delete env.ANTHROPIC_API_KEY; r = await call(); env.ANTHROPIC_API_KEY = 'sk-test';
check('sin clave → 503', r.status === 503);
reply = { reply: '¿Con quién la agendo?', actions: [] };
r = await call(); j = await r.json();
check('puede devolver solo una pregunta', r.status === 200 && j.reply === '¿Con quién la agendo?' && j.actions.length === 0);
reply = { reply: 'x', actions: Array.from({ length: 12 }, () => ({ ...nulls, type: 'open', screen: 'agenda' })) };
r = await call(); j = await r.json();
check('máximo 6 acciones', j.actions.length === 6);

server.close();
console.log(failed ? `\n${failed} fallidas` : '\ntodo correcto');
process.exit(failed ? 1 : 0);
