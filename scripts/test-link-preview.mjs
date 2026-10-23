// Offline checks of netlify/functions/link-preview.mts: HTML parsing and the guard that keeps it away from private networks.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const proj = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'lp-fn-'));
mkdirSync(join(out, 'netlify/functions'), { recursive: true });
symlinkSync(join(proj, 'node_modules'), join(out, 'node_modules'));
writeFileSync(join(out, 'netlify/functions/lp.mjs'), ts.transpileModule(readFileSync(join(proj, 'netlify/functions/link-preview.mts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);

const supa = createServer((req, res) => { res.writeHead(req.headers.authorization === 'Bearer good' ? 200 : 401, { 'content-type': 'application/json' }); res.end('{"id":"u1"}'); });
await new Promise((r) => supa.listen(0, r));
const env = { SUPABASE_URL: `http://127.0.0.1:${supa.address().port}`, SUPABASE_PUBLISHABLE_KEY: 'pk' };
globalThis.Netlify = { env: { get: (k) => env[k] } };
const { default: handler, parseMeta, privateAddress } = await import(pathToFileURL(join(out, 'netlify/functions/lp.mjs')).href);

let failed = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${label}${ok ? '' : ` ${extra}`}`); if (!ok) failed++; };
const call = (url, token = 'good', method = 'GET') => handler(new Request(`https://x.test/api/link-preview?url=${encodeURIComponent(url)}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {} }));

for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '0.0.0.0']) check(`${ip} es privada`, privateAddress(ip) === true);
for (const ip of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111']) check(`${ip} es pública`, privateAddress(ip) === false);

const page = parseMeta(`<html><head><title>  Fallback &amp; co </title><meta content="Café &quot;Aurora&quot;" property="og:title"><meta property='og:description' content='Pan de masa madre'><meta property="og:image" content="/img/cover.jpg"><meta property="og:site_name" content="Aurora"></head></html>`, new URL('https://aurora.example/menu'));
check('título OG con comillas y atributos en otro orden', page.title === 'Café "Aurora"', JSON.stringify(page));
check('descripción con comillas simples', page.description === 'Pan de masa madre');
check('imagen relativa → absoluta', page.image === 'https://aurora.example/img/cover.jpg');
check('nombre del sitio', page.site === 'Aurora');
const plain = parseMeta('<title>Solo título &amp; más</title>', new URL('https://www.sitio.com/a'));
check('sin OG usa <title> y el dominio', plain.title === 'Solo título & más' && plain.site === 'sitio.com' && plain.image === null);
check('javascript: no es imagen', parseMeta('<meta property="og:image" content="javascript:alert(1)">', new URL('https://a.com')).image === null);

check('sin sesión → 401', (await call('https://example.com', null)).status === 401);
check('sesión inválida → 401', (await call('https://example.com', 'bad')).status === 401);
check('POST → 405', (await call('https://example.com', 'good', 'POST')).status === 405);
for (const bad of ['http://localhost/x', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'ftp://example.com/', 'file:///etc/passwd', 'https://user:pw@example.com/', 'http://example.com:8080/', 'notaurl', 'http://intranet.local/']) check(`rechaza ${bad}`, (await call(bad)).status === 400);

supa.close();
console.log(failed ? `\n${failed} fallaron` : '\ntodo correcto');
process.exit(failed ? 1 : 0);
