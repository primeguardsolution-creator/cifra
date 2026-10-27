/**
 * Who runs CIFRA. The legal texts (terms, privacy) use these fields. Fill them in before the App Store / Google Play submission:
 * Apple, the EU Digital Services Act and data-protection law require the operator to be identified and reachable.
 * Empty fields are simply left out of the texts.
 */
export const COMPANY = {
  /** Legal name of the person or company that operates CIFRA, e.g. "Anela Tech Studio" */
  legalName: 'Anela Tech & Design Studio',
  /** Postal address (street, postcode, city, country) */
  address: 'Ystader Straße 13, 10437 Berlin, Alemania',
  /** Contact e-mail for support, privacy requests and legal notices */
  email: 'contact@anela.studio',
  /** Country whose law governs the terms, e.g. "Alemania" / "Germany" / "Deutschland" (per language below) */
  law: { es: 'Alemania', en: 'Germany', de: 'Deutschland' },
  /** Date of the current version of both documents (YYYY-MM-DD) */
  updated: '2026-10-27',
};

export type Lang = 'es' | 'en' | 'de';
export const operator = (l: Lang) => {
  const n = COMPANY.legalName.trim(); const a = COMPANY.address.trim();
  if (!n) return { who: { es: 'el equipo de CIFRA', en: 'the CIFRA team', de: 'das CIFRA-Team' }[l], full: { es: 'el equipo de CIFRA', en: 'the CIFRA team', de: 'das CIFRA-Team' }[l], mail: COMPANY.email.trim() };
  return { who: n, full: a ? `${n}, ${a}` : n, mail: COMPANY.email.trim() };
};
export const contactLine = (l: Lang) => {
  const m = COMPANY.email.trim();
  return m ? m : ({ es: 'el asistente de la app (Ajustes → Maestro CIFRA) o el formulario de reportes', en: 'the in-app assistant (Settings → Maestro CIFRA) or the report form', de: 'den Assistenten in der App (Einstellungen → Maestro CIFRA) oder das Meldeformular' }[l]);
};
export type Section = { h: string; p: string[] };
export type Doc = { title: string; intro: string[]; sections: Section[] };
