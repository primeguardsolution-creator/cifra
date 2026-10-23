import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Tiny physical feedback: native haptics on phones, a short vibration on supporting browsers. Never throws. */
function vibrate(ms: number | number[]) {
  try { if (Platform.OS === 'web' && typeof navigator !== 'undefined') navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
export const hapticTap = () => { if (Platform.OS === 'web') vibrate(6); else Haptics.selectionAsync().catch(() => {}); };
export const hapticSoft = () => { if (Platform.OS === 'web') vibrate(10); else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
export const hapticSuccess = () => { if (Platform.OS === 'web') vibrate([8, 40, 12]); else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
