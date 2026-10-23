import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui';

/** The assistant's face: accent gradient with a sparkle. Same squircle language as the business avatars, so it reads as "official". */
export function BotAvatar({ size = 48 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.34, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={[c.accent, c.highlight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', width: size, height: size }} />
      <Icon name="sparkles" size={size * 0.5} color={c.accentText} />
    </View>
  );
}
