import { LinearGradient } from 'expo-linear-gradient';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The iPhone home-screen app draws under the status bar (black-translucent) and its clock is always white. On a light theme that
 * would vanish into the light background, so in light mode only the very top of the screen gets a soft dark tint. Dark mode: nothing.
 */
export function TopScrim() {
  const { mode } = useTheme();
  const { top } = useSafeAreaInsets();
  if (Platform.OS !== 'web' || mode !== 'light' || top < 8) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top + 6, zIndex: 9999 }}>
      <LinearGradient colors={['rgba(20,20,35,0.5)', 'rgba(20,20,35,0)']} style={{ flex: 1 }} />
    </View>
  );
}
