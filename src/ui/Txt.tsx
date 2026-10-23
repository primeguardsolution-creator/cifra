import { Text, TextProps, TextStyle } from 'react-native';
import { font } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { tr } from '../i18n';

export type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small' | 'smallStrong' | 'caption' | 'mono';
type Tone = 'text' | 'muted' | 'faint' | 'accent' | 'danger' | 'onAccent' | 'success';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: font.displayHeavy, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
  h1: { fontFamily: font.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  h2: { fontFamily: font.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: font.display, fontSize: 17, lineHeight: 23, letterSpacing: -0.15 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: font.mono, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
};

/** Every piece of UI text goes through here, so a plain Spanish string in JSX is translated on the fly. */
const translate = (n: React.ReactNode): React.ReactNode => (typeof n === 'string' ? tr(n) : Array.isArray(n) ? n.map((x) => (typeof x === 'string' ? tr(x) : x)) : n);

export function Txt({ v = 'body', tone = 'text', style, children, ...props }: TextProps & { v?: Variant; tone?: Tone }) {
  const { c } = useTheme();
  const color = { text: c.text, muted: c.textMuted, faint: c.textFaint, accent: c.accent, danger: c.danger, onAccent: c.accentText, success: c.success }[tone];
  return <Text {...props} accessibilityLabel={props.accessibilityLabel ? tr(props.accessibilityLabel) : undefined} style={[variants[v], { color }, style]}>{translate(children)}</Text>;
}
