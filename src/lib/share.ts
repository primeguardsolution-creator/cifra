import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';
import { tr } from '../i18n';

export const appUrl = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_APP_URL ?? 'https://cifra.app');

/** Native share sheet where available, clipboard otherwise. Returns true when the text was copied. */
export async function shareText(rawMessage: string, url?: string): Promise<'shared' | 'copied'> {
  const message = tr(rawMessage); // invitations go out in the language the app is set to
  const full = url ? `${message} ${url}` : message;
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string; url?: string }) => Promise<void> }) : null;
      if (nav?.share) { await nav.share({ text: message, url }); return 'shared'; }
    } else { await Share.share({ message: full }); return 'shared'; }
  } catch { /* user dismissed the sheet, fall back to copy */ }
  await Clipboard.setStringAsync(full);
  return 'copied';
}

export const inviteMessage = 'Te invito a CIFRA, mensajería privada con espacio Personal y Business.';
