// Fails when a Spanish UI string in the source has no English + German entry in src/i18n/dict.ts.
// Run: npm run test:i18n
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../src', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'i18n-'));
writeFileSync(join(out, 'dict.mjs'), ts.transpileModule(readFileSync(join(root, 'i18n/dict.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { rows } = await import(pathToFileURL(join(out, 'dict.mjs')).href);
const dict = new Map(rows.map((r) => [r[0].trim(), r]));

const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } })(root);
// Files whose Spanish is data for the assistant / Doer interpreters (translated in their own packs) or not UI at all.
const skipFiles = /features\/assistant\/(knowledge|engine|packs)|features\/doer\/(actions|parse)|i18n\/|app\/\+html\.|lib\/(countryAliases|push)\./;
const looksText = (s) => /[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]/.test(s) && (/\s/.test(s) || /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(s) || /^[A-ZÁÉÍÓÚ][A-Za-záéíóúñ]+$/.test(s) || /^[A-ZÁÉÍÓÚ]{3,}$/.test(s)) && !/^[a-z0-9_\-\/.:#@]+$/.test(s) && !/^(https?:|\/|\.|#|rgba?\()/.test(s);
const technical = [/^(INSERT|UPDATE|DELETE|SUBSCRIBED)$/, /^[A-Z]{2,5}$/, /^[a-z_]+(, [a-z_:()]+)+$/i, /gradient|<path|<rect|<circle|<svg|px\b|width=device|html, body|must be used inside|^Bearer|^payload too large|^Backspace$|^Enter$|^fmt\b|^[a-z_]+, [a-z_]+|created_at, message|role, business|^%sin respuesta|^maestro cifra asistente|^1\.5px|^0 12px|^id, /];
const missing = new Map();
const checkStr = (s, rel) => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t || !looksText(t) || technical.some((re) => re.test(t))) return;
  if (!dict.has(t)) { if (!missing.has(t)) missing.set(t, new Set()); missing.get(t).add(rel); }
};
for (const f of files) {
  if (skipFiles.test(f)) continue;
  const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.ES2022, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = f.replace(root + '/', '');
  (function visit(n) {
    if (ts.isImportDeclaration(n)) return;
    if (ts.isJsxText(n)) checkStr(n.text, rel);
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const p = n.parent;
      if (!((ts.isPropertyAssignment(p) && p.name === n) || ts.isElementAccessExpression(p) || ts.isCaseClause(p) || ts.isLiteralTypeNode(p))) checkStr(n.text, rel);
    }
    ts.forEachChild(n, visit);
  })(sf);
}
let bad = 0;
for (const [s, where] of missing) { console.log(`✗ sin traducción: "${s.slice(0, 90)}"  (${[...where][0]})`); bad++; }
const holes = rows.filter(([es, en, de]) => !en?.trim() || !de?.trim());
holes.forEach(([es]) => { console.log(`✗ entrada incompleta: "${es.slice(0, 60)}"`); bad++; });
const ph = rows.filter(([es, en, de]) => { const f = (x) => (x.match(/\{\w+\}/g) ?? []).sort().join(); return f(es) !== f(en) || f(es) !== f(de); });
ph.forEach(([es]) => { console.log(`✗ los {placeholders} no coinciden: "${es.slice(0, 60)}"`); bad++; });
console.log(bad ? `\n${bad} problemas · ${rows.length} entradas` : `todo traducido · ${rows.length} entradas`);
process.exit(bad ? 1 : 0);
