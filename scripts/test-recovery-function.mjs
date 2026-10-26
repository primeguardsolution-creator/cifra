// Exercises netlify/functions/recovery.mts against in-memory stand-ins for Supabase (recovery_* functions, auth admin) and Brevo.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const proj = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'rec-fn-'));
mkdirSync(join(out, 'netlify/functions'), { recursive: true });
symlinkSync(join(proj, 'node_modules'), join(out, 'node_modules'));
writeFileSync(join(out, 'netlify/functions/rec.mjs'), ts.transpileModule(readFileSync(join(proj, 'netlify/functions/recovery.mts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);

const env = { SUPABASE_URL: 'https://sb.test', SUPABASE_PUBLISHABLE_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', BREVO_API_KEY: 'brevo-key', MAIL_FROM_EMAIL: 'no-reply@cifra.test', RECOVERY_PEPPER: 'pep' };
globalThis.Netlify = { env: { get: (k) => env[k] } };
const { default: handler, hashSecret, normalizeCode } = await import(pathToFileURL(join(out, 'netlify/functions/rec.mjs')).href);

// ── fakes ──
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const db = { phones: { '+34600111222': U }, rec: { [U]: { email: null, verified: false, pending: null, otp: null, purpose: null, code: null } } };
const sent = []; const passwordPuts = []; let brevoStatus = 201;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const body = init.body ? JSON.parse(init.body) : {};
  const ok = (v) => new Response(JSON.stringify(v), { status: 200 });
  if (url === 'https://sb.test/auth/v1/user') return init.headers.authorization === 'Bearer good' ? ok({ id: U }) : new Response('{}', { status: 401 });
  if (url.startsWith(`https://sb.test/auth/v1/admin/users/`)) { passwordPuts.push({ id: url.split('/').pop(), ...body, auth: init.headers.authorization }); return ok({}); }
  if (url === 'https://api.brevo.com/v3/smtp/email') { sent.push({ key: init.headers['api-key'], ...body }); return new Response(brevoStatus >= 400 ? '{"code":"unauthorized","message":"Sender not valid"}' : '{}', { status: brevoStatus }); }
  if (url.startsWith('https://sb.test/rest/v1/rpc/')) {
    const fn = url.split('/').pop(); const r = db.rec[body.p_user];
    if (fn === 'recovery_lookup') { const id = db.phones[body.p_phone]; const x = id && db.rec[id]; return ok(id ? [{ user_id: id, has_email: x.verified, email: x.verified ? x.email : null, has_code: !!x.code }] : []); }
    if (fn === 'recovery_begin_email') { r.otp = body.p_otp_hash; r.purpose = body.p_purpose; if (body.p_purpose === 'verify') r.pending = body.p_email; return ok(null); }
    if (fn === 'recovery_check_otp') { const good = r.otp && r.otp === body.p_otp_hash && r.purpose === body.p_purpose; if (good) { r.otp = null; if (body.p_purpose === 'verify') { r.email = r.pending; r.verified = true; } } return ok(!!good); }
    if (fn === 'recovery_set_code') { r.code = body.p_code_hash; return ok(null); }
    if (fn === 'recovery_check_code') { const good = r.code && r.code === body.p_code_hash; if (good) r.code = null; return ok(!!good); }
  }
  return new Response('{}', { status: 404 });
};

let failed = 0;
const check = (label, cond, extra = '') => { console.log(`${cond ? '  ✓' : '  ✗'} ${label}${cond ? '' : ` ${extra}`}`); if (!cond) failed++; };
let n = 0;
const post = (b, token = null, method = 'POST') => handler(new Request('https://x.test/api/recovery', { method, headers: { 'x-nf-client-connection-ip': `10.0.0.${++n % 250}`, ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(b) } : {}) }));
const lastCode = () => /\b(\d{6})\b/.exec(sent.at(-1).textContent)[1];

check('GET → 405', (await post({}, null, 'GET')).status === 405);
check('email_start sin sesión → 401', (await post({ action: 'email_start', email: 'a@b.co' })).status === 401);
check('correo inválido → 400', (await post({ action: 'email_start', email: 'nope' }, 'good')).status === 400);

let r = await post({ action: 'email_start', email: 'Eva@Example.com', locale: 'en' }, 'good');
check('email_start envía el correo por Brevo', r.status === 200 && sent.length === 1 && sent[0].to[0].email === 'eva@example.com' && sent[0].key === 'brevo-key');
check('asunto en inglés con el código', /^\d{6} is your CIFRA code$/.test(sent[0].subject), sent[0].subject);
check('la base nunca recibe el código en claro', db.rec[U].otp !== lastCode() && /^[0-9a-f]{64}$/.test(db.rec[U].otp));
check('código incorrecto → 400', (await post({ action: 'email_confirm', code: '000000' }, 'good')).status === 400);
check('código correcto verifica el correo', (await post({ action: 'email_confirm', code: lastCode() }, 'good')).status === 200 && db.rec[U].verified && db.rec[U].email === 'eva@example.com');
brevoStatus = 500; r = await post({ action: 'email_start', email: 'otro@example.com' }, 'good'); brevoStatus = 201;
{ const j = await r.json(); check('si Brevo falla → 502 mail_failed con la razón de Brevo', r.status === 502 && j.error === 'mail_failed' && /Brevo 500: unauthorized · Sender not valid/.test(j.hint), JSON.stringify(j)); }
env.MAIL_FROM_EMAIL = ''; { const j = await (await post({ action: 'email_start', email: 'otro@example.com' }, 'good')).json(); check('sin remitente configurado dice qué variable falta', /MAIL_FROM_EMAIL missing/.test(j.hint), JSON.stringify(j)); } env.MAIL_FROM_EMAIL = 'no-reply@cifra.test';

r = await post({ action: 'make_code' }, 'good'); const { code } = await r.json();
check('make_code devuelve XXXX-XXXX-XXXX sin 0/O/1/I', /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code), code);
check('se guarda solo el hash del código', db.rec[U].code === hashSecret('pep', U, 'code', normalizeCode(code)));

sent.length = 0;
r = await post({ action: 'reset_start', phone: '+34999000111' });
check('reset_start con número desconocido: misma respuesta y ningún correo', r.status === 200 && (await r.json()).ok === true && sent.length === 0);
r = await post({ action: 'reset_start', phone: '+34600111222', locale: 'de' });
check('reset_start con correo verificado envía el código (alemán)', r.status === 200 && sent.length === 1 && sent[0].to[0].email === 'eva@example.com' && /Wiederherstellung/.test(sent[0].subject));
check('contraseña corta → 400 y no cambia nada', (await post({ action: 'reset_finish', phone: '+34600111222', method: 'email', secret: lastCode(), password: 'corta' })).status === 400 && passwordPuts.length === 0);
check('código erróneo → 400 genérico', (await post({ action: 'reset_finish', phone: '+34600111222', method: 'email', secret: '123456', password: 'nuevaclave1' })).status === 400 && passwordPuts.length === 0);
r = await post({ action: 'reset_finish', phone: '+34600111222', method: 'email', secret: lastCode(), password: 'nuevaclave1' });
check('código del correo → contraseña cambiada con la clave de servicio', r.status === 200 && passwordPuts.length === 1 && passwordPuts[0].id === U && passwordPuts[0].password === 'nuevaclave1' && passwordPuts[0].auth === 'Bearer service');
check('el mismo código no sirve dos veces', (await post({ action: 'reset_finish', phone: '+34600111222', method: 'email', secret: lastCode(), password: 'otraclave12' })).status === 400);

r = await post({ action: 'reset_finish', phone: '+34600111222', method: 'code', secret: code.toLowerCase().replaceAll('-', ' '), password: 'clavenueva22' });
check('código de recuperación (minúsculas, sin guiones) → cambia la contraseña', r.status === 200 && (await r.json()).usedCode === true && passwordPuts.length === 2);
check('el código de recuperación es de un solo uso', (await post({ action: 'reset_finish', phone: '+34600111222', method: 'code', secret: code, password: 'clavenueva33' })).status === 400 && passwordPuts.length === 2);
check('teléfono desconocido en reset_finish → 400 igual', (await post({ action: 'reset_finish', phone: '+34999000111', method: 'code', secret: code, password: 'clavenueva33' })).status === 400);
check('acción desconocida → 400', (await post({ action: 'x' }, 'good')).status === 400);
let tooMany = 0; for (let i = 0; i < 40; i++) { const x = await handler(new Request('https://x.test/api/recovery', { method: 'POST', headers: { 'x-nf-client-connection-ip': '9.9.9.9' }, body: JSON.stringify({ action: 'reset_start', phone: '+34999000111' }) })); if (x.status === 429) tooMany++; }
check('inundación desde una misma IP → 429', tooMany > 0);
console.log(failed ? `\n${failed} fallaron` : '\ntodo correcto');
process.exit(failed ? 1 : 0);
