import { forwardRef, useState } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';
import { Icon, IconName } from './Icon';
import { tr } from '../i18n';
import { Txt } from './Txt';

type Props = TextInputProps & { label?: string; error?: string | null; icon?: IconName; hint?: string; left?: React.ReactNode; right?: React.ReactNode };

export const Field = forwardRef<TextInput, Props>(function Field({ label, error, icon, hint, left, right, style, ...props }, ref) {
  const { c, r } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && <Txt v="caption" tone="muted" style={{ marginLeft: 2 }}>{label}</Txt>}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: r(radius.md), borderWidth: 1.5, borderColor: error ? c.danger : focus ? c.accent : c.border, minHeight: 52, paddingHorizontal: 14, gap: 10 }}>
        {left}
        {icon && <Icon name={icon} size={19} tone="muted" />}
        <TextInput
          ref={ref} placeholderTextColor={c.textFaint} selectionColor={c.accent} accessibilityLabel={label ? tr(label) : undefined}
          {...props}
          placeholder={props.placeholder ? tr(props.placeholder) : undefined}
          onFocus={(e) => { setFocus(true); props.onFocus?.(e); }} onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
          style={[{ flex: 1, color: c.text, fontFamily: font.regular, fontSize: 16, paddingVertical: 13, outlineStyle: 'none' } as object, style]}
        />
        {right}
      </View>
      {error ? <Txt v="caption" tone="danger" style={{ marginLeft: 2 }} accessibilityLiveRegion="polite">{error}</Txt> : hint ? <Txt v="caption" tone="faint" style={{ marginLeft: 2 }}>{hint}</Txt> : null}
    </View>
  );
});
