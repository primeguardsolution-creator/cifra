import { loc } from '../i18n';
import { ALIASES } from './countryAliases';

export type Country = { iso: string; name: string; dial: string; keepZero?: boolean };

export const countries: Country[] = [
  { iso: 'ES', name: 'España', dial: '34' }, { iso: 'MX', name: 'México', dial: '52' }, { iso: 'US', name: 'Estados Unidos', dial: '1' },
  { iso: 'AR', name: 'Argentina', dial: '54' }, { iso: 'CO', name: 'Colombia', dial: '57' }, { iso: 'CL', name: 'Chile', dial: '56' },
  { iso: 'PE', name: 'Perú', dial: '51' }, { iso: 'VE', name: 'Venezuela', dial: '58' }, { iso: 'EC', name: 'Ecuador', dial: '593' },
  { iso: 'UY', name: 'Uruguay', dial: '598' }, { iso: 'PY', name: 'Paraguay', dial: '595' }, { iso: 'BO', name: 'Bolivia', dial: '591' },
  { iso: 'CR', name: 'Costa Rica', dial: '506' }, { iso: 'PA', name: 'Panamá', dial: '507' }, { iso: 'GT', name: 'Guatemala', dial: '502' },
  { iso: 'HN', name: 'Honduras', dial: '504' }, { iso: 'SV', name: 'El Salvador', dial: '503' }, { iso: 'NI', name: 'Nicaragua', dial: '505' },
  { iso: 'DO', name: 'Rep. Dominicana', dial: '1809' }, { iso: 'CU', name: 'Cuba', dial: '53' }, { iso: 'PR', name: 'Puerto Rico', dial: '1787' },
  { iso: 'BR', name: 'Brasil', dial: '55' }, { iso: 'PT', name: 'Portugal', dial: '351' }, { iso: 'FR', name: 'Francia', dial: '33' },
  { iso: 'DE', name: 'Alemania', dial: '49' }, { iso: 'IT', name: 'Italia', dial: '39', keepZero: true }, { iso: 'GB', name: 'Reino Unido', dial: '44' },
  { iso: 'IE', name: 'Irlanda', dial: '353' }, { iso: 'NL', name: 'Países Bajos', dial: '31' }, { iso: 'BE', name: 'Bélgica', dial: '32' },
  { iso: 'CH', name: 'Suiza', dial: '41' }, { iso: 'AT', name: 'Austria', dial: '43' }, { iso: 'SE', name: 'Suecia', dial: '46' },
  { iso: 'NO', name: 'Noruega', dial: '47' }, { iso: 'DK', name: 'Dinamarca', dial: '45' }, { iso: 'FI', name: 'Finlandia', dial: '358' },
  { iso: 'PL', name: 'Polonia', dial: '48' }, { iso: 'RO', name: 'Rumanía', dial: '40' }, { iso: 'GR', name: 'Grecia', dial: '30' },
  { iso: 'TR', name: 'Turquía', dial: '90' }, { iso: 'UA', name: 'Ucrania', dial: '380' }, { iso: 'RU', name: 'Rusia', dial: '7' },
  { iso: 'MA', name: 'Marruecos', dial: '212' }, { iso: 'DZ', name: 'Argelia', dial: '213' }, { iso: 'EG', name: 'Egipto', dial: '20' },
  { iso: 'NG', name: 'Nigeria', dial: '234' }, { iso: 'ZA', name: 'Sudáfrica', dial: '27' }, { iso: 'KE', name: 'Kenia', dial: '254' },
  { iso: 'AE', name: 'Emiratos Árabes', dial: '971' }, { iso: 'SA', name: 'Arabia Saudí', dial: '966' }, { iso: 'IL', name: 'Israel', dial: '972' },
  { iso: 'IN', name: 'India', dial: '91' }, { iso: 'PK', name: 'Pakistán', dial: '92' }, { iso: 'BD', name: 'Bangladés', dial: '880' },
  { iso: 'CN', name: 'China', dial: '86' }, { iso: 'JP', name: 'Japón', dial: '81' }, { iso: 'KR', name: 'Corea del Sur', dial: '82' },
  { iso: 'PH', name: 'Filipinas', dial: '63' }, { iso: 'ID', name: 'Indonesia', dial: '62' }, { iso: 'TH', name: 'Tailandia', dial: '66' },
  { iso: 'VN', name: 'Vietnam', dial: '84' }, { iso: 'AU', name: 'Australia', dial: '61' }, { iso: 'NZ', name: 'Nueva Zelanda', dial: '64' },
  { iso: 'CA', name: 'Canadá', dial: '1' },
];

const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const displayNames: Record<string, { of: (iso: string) => string | undefined } | null> = {};
function namesIn(lang: string, iso: string): string | undefined {
  try {
    if (displayNames[lang] === undefined) displayNames[lang] = typeof Intl !== 'undefined' && !!(Intl as { DisplayNames?: unknown }).DisplayNames ? new (Intl as unknown as { DisplayNames: new (l: string[], o: { type: string }) => { of: (iso: string) => string | undefined } }).DisplayNames([lang], { type: 'region' }) : null;
    return displayNames[lang]?.of(iso);
  } catch { return undefined; }
}
/** The country's name in the language of the app (falls back to the Spanish source name). */
export const countryName = (c: Country, lang: string = loc()) => (lang === 'es' ? c.name : namesIn(lang, c.iso) ?? c.name);
/**
 * Country search that works in any of the app's languages at once: Spanish, English and German names (accents and case
 * ignored), the name in the current language, the ISO code and the dial prefix.
 */
export function countryMatches(c: Country, query: string): boolean {
  const q = fold(query.replace(/^\+/, ''));
  if (!q) return true;
  if (/^\d+$/.test(q)) return c.dial.startsWith(q);
  if (c.iso.toLowerCase() === q) return true;
  return [c.name, namesIn('es', c.iso), namesIn('en', c.iso), namesIn('de', c.iso), countryName(c), ...(ALIASES[c.iso] ?? [])].some((n) => !!n && fold(n).includes(q));
}

export const flag = (iso: string) => String.fromCodePoint(...iso.toUpperCase().split('').map((ch) => 127397 + ch.charCodeAt(0)));

export type PhoneResult = { ok: true; e164: string } | { ok: false; reason: string };

/** Builds an E.164 number from a country and the national digits the person typed. */
export function toE164(country: Country, input: string): PhoneResult {
  let digits = input.replace(/\D/g, '');
  if (input.trim().startsWith('+')) {
    // person typed the full international number
    return digits.length >= 8 && digits.length <= 15 ? { ok: true, e164: `+${digits}` } : { ok: false, reason: 'Número demasiado corto o largo.' };
  }
  if (!country.keepZero) digits = digits.replace(/^0+/, '');
  if (digits.startsWith(country.dial) && digits.length > country.dial.length + 7) digits = digits.slice(country.dial.length);
  if (digits.length < 6) return { ok: false, reason: 'Escribe tu número completo.' };
  const e164 = `+${country.dial}${digits}`;
  if (e164.length - 1 > 15) return { ok: false, reason: 'Ese número es demasiado largo.' };
  return { ok: true, e164 };
}

export function formatPhone(e164?: string | null) {
  if (!e164) return '';
  const m = [...countries].sort((a, b) => b.dial.length - a.dial.length).find((c) => e164.startsWith('+' + c.dial));
  if (!m) return e164;
  const rest = e164.slice(m.dial.length + 1);
  return `+${m.dial} ${rest.replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`;
}

/** Internal sign-in identity used while SMS verification is off. example.com is IANA-reserved: no one can receive mail there. */
export const ALIAS_DOMAIN = 'phone.example.com';
export const aliasEmail = (e164: string) => `p${e164.replace(/\D/g, '')}@${ALIAS_DOMAIN}`;
export const phoneFromAlias = (email?: string | null) => {
  const m = email?.match(/^p(\d{7,15})@phone\.example\.com$/);
  return m ? `+${m[1]}` : null;
};
