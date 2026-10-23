import { BlurView } from 'expo-blur';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * "Liquid glass" surface for a few floating controls (hero buttons, the space switch, the tab bar): blurred backdrop,
 * a translucent tint, a hairline edge and a soft highlight along the top. Used sparingly, never for text-heavy areas.
 */
export function Glass({ children, style, radius = 16, intensity, tint }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; radius?: number; intensity?: number; tint?: 'light' | 'dark' }) {
  const { c, mode, space } = useTheme();
  const dark = (tint ?? (mode === 'dark' ? 'dark' : 'light')) === 'dark';
  const flat = space === 'business'; // Business keeps its squarer, flatter look: same blur, less shine
  return (
    <BlurView intensity={intensity ?? (Platform.OS === 'web' ? 60 : 45)} tint={dark ? 'dark' : 'light'}
      style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.75)', backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.45)' }, style]}>
      {!flat && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: radius * 0.5, right: radius * 0.5, height: 1, backgroundColor: dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.95)' }} />}
      {children}
    </BlurView>
  );
}
