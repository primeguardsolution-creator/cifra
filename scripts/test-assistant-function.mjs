// Exercises netlify/functions/assistant.mts end to end against local mocks of Supabase and the Anthropic API (no real key, no cost).
// Run: npm run test:assistant-fn
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const proj = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'assistant-fn-'));
mkdirSync(join(out, 'netlify/functions'), { recursive: true });
mkdirSync(join(out, 'src/features/assistant'), { recursive: true });
symlinkSync(join(proj, 'node_modules'), join(out, 'node_modules'));
const compile = (rel, dest, fix = (s) => s) => writeFileSync(join(out, dest), fix(ts.transpileModule(readFileSync(join(proj, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText));
compile('src/features/assistant/knowledge.ts', 'src/features/assistant/knowledge.mjs');
compile('netlify/functions/assistant.mts', 'netlify/functions/assistant.mjs', (s) => s.replace("/knowledge'", "/knowledge.mjs'"));

let rateLimited = false;
let authOk = true;
const seen = { anthropic: null, headers: null };
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url.startsWith('/auth/v1/user')) return authOk ? send(200, { id: 'u1' }) : send(401, {});
    if (req.url.startsWith('/rest/v1/rpc/check_assistant_rate')) return rateLimited ? send(400, { message: 'rate_limited' }) : send(200, null);
    if (req.url.startsWith('/v1/messages')) {
      seen.anthropic = JSON.parse(body); seen.headers = req.headers;
      return send(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: '**Hola**, así se hace.' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 } });
    }
    send(404, {});
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const env = { SUPABASE_URL: base, SUPABASE_PUBLISHABLE_KEY: 'pk', ANTHROPIC_API_KEY: 'sk-test' };
globalThis.Netlify = { env: { get: (k) => env[k] } };
process.env.ANTHROPIC_BASE_URL = base;
const handler = (await import(pathToFileURL(join(out, 'netlify/functions/assistant.mjs')).href)).default;

let failed = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${label}${ok ? '' : ` ${extra}`}`); if (!ok) failed++; };
const call = (init = {}) => handler(new Request('http://x/api/assistant', { method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: '¿cómo hago una cosa rara?' }] }), ...init }));

let r = await call(); let j = await r.json();
check('200 con texto de Claude (los bloques thinking se ignoran)', r.status === 200 && j.text === '**Hola**, así se hace.', JSON.stringify(j));
check('usa claude-opus-5-5 con effort bajo, sin parámetros prohibidos', seen.anthropic.model === 'claude-opus-5-5' && seen.anthropic.output_config?.effort === 'low' && !('temperature' in seen.anthropic) && !('thinking' in seen.anthropic));
check('pide el fallback por defecto con su cabecera beta', seen.anthropic.fallbacks === 'default' && /server-side-fallback-2026-07-01/.test(seen.headers['anthropic-beta'] ?? ''), seen.headers['anthropic-beta']);
check('el prompt de sistema lleva la base de conocimiento y se marca para caché', seen.anthropic.system[0].cache_control?.type === 'ephemeral' && /Programar mensajes/.test(seen.anthropic.system[0].text) && /no es cifrado de extremo a extremo/i.test(seen.anthropic.system[0].text));
check('el mensaje del usuario llega como turno user', seen.anthropic.messages.at(-1).role === 'user');

r = await call({ headers: { 'content-type': 'application/json' } });
check('sin sesión → 401', r.status === 401);
authOk = false; r = await call(); authOk = true;
check('sesión inválida → 401', r.status === 401);
r = await call({ body: JSON.stringify({ messages: [{ role: 'assistant', content: 'hola' }] }) });
check('historial sin pregunta final del usuario → 400', r.status === 400);
r = await call({ body: 'no json' });
check('cuerpo que no es JSON → 400', r.status === 400);
rateLimited = true; r = await call(); rateLimited = false;
check('límite por usuario excedido → 429 y no se gasta IA', r.status === 429);
r = await handler(new Request('http://x/api/assistant', { method: 'GET' }));
check('GET → 405', r.status === 405);
delete env.ANTHROPIC_API_KEY; r = await call(); env.ANTHROPIC_API_KEY = 'sk-test';
check('sin ANTHROPIC_API_KEY → 503 (la app cae a la base local)', r.status === 503);
const long = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(5000) + i }));
long.push({ role: 'user', content: 'final' });
await call({ body: JSON.stringify({ messages: long }) });
check('recorta el historial (≤10 turnos, ≤600 caracteres cada uno)', seen.anthropic.messages.length <= 10 && seen.anthropic.messages.every((m) => (typeof m.content === 'string' ? m.content.length : 0) <= 600));

server.close();
console.log(failed ? `\n${failed} fallidas` : '\ntodo correcto');
process.exit(failed ? 1 : 0);
