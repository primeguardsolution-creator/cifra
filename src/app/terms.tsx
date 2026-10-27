import { LegalDoc } from '../components/LegalDoc';
import { termsDe } from '../legal/terms.de';
import { termsEn } from '../legal/terms.en';
import { termsEs } from '../legal/terms.es';

export default function Terms() { return <LegalDoc docs={{ es: termsEs, en: termsEn, de: termsDe }} />; }
