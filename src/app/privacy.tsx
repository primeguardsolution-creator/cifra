import { LegalDoc } from '../components/LegalDoc';
import { privacyDe } from '../legal/privacy.de';
import { privacyEn } from '../legal/privacy.en';
import { privacyEs } from '../legal/privacy.es';

export default function Privacy() { return <LegalDoc docs={{ es: privacyEs, en: privacyEn, de: privacyDe }} />; }
