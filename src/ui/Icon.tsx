import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

export type IconName = keyof typeof Ionicons.glyphMap;

export function Icon({ name, size = 22, color, tone = 'text' }: { name: IconName; size?: number; color?: string; tone?: 'text' | 'muted' | 'faint' | 'accent' | 'danger' | 'onAccent' }) {
  const { c } = useTheme();
  const resolved = color ?? { text: c.text, muted: c.textMuted, faint: c.textFaint, accent: c.accent, danger: c.danger, onAccent: c.accentText }[tone];
  return <Ionicons name={name} size={size} color={resolved} />;
}
