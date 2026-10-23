import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';
import { Icon, IconName, Pressy, Txt } from '../ui';
import { tr } from '../i18n';

/** Page header used by every Business screen: mono eyebrow, display title, square action keys. */
export function BizHeader({ eyebrow, title, right, sub }: { eyebrow: string; title: string; right?: React.ReactNode; sub?: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="mono" style={{ color: c.highlight, letterSpacing: 1.2 }}>{tr(eyebrow).toUpperCase()}</Txt>
        <Txt v="h1" numberOfLines={1} style={{ fontSize: 26, lineHeight: 32 }}>{title}</Txt>
        {sub ? <Txt v="small" tone="muted" numberOfLines={1}>{sub}</Txt> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{right}</View>
    </View>
  );
}

/** Square-cornered action key (Business buttons are never pills). */
export function Key({ icon, label, onPress, primary, small }: { icon?: IconName; label?: string; onPress: () => void; primary?: boolean; small?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressy onPress={onPress} accessibilityRole="button" accessibilityLabel={label ?? icon} scale={0.95}
      style={{ height: small ? 34 : 40, minWidth: small ? 34 : 40, paddingHorizontal: label ? 13 : 0, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: primary ? c.highlight : c.sunken, borderWidth: 1, borderColor: primary ? c.highlight : c.border }}>
      {icon && <Icon name={icon} size={small ? 15 : 18} color={primary ? c.highlightText : c.text} />}
      {label && <Txt v="smallStrong" style={{ color: primary ? c.highlightText : c.text }}>{label}</Txt>}
    </Pressy>
  );
}

export function Pill({ label, color, solid }: { label: string; color: string; solid?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 22, borderRadius: 4, backgroundColor: solid ? color : `${color}26` }}>
      {!solid && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />}
      <Txt style={{ fontSize: 11, lineHeight: 14, fontFamily: font.semibold, color: solid ? '#fff' : color }}>{label}</Txt>
    </View>
  );
}

export function NoBusiness({ onCreate }: { onCreate: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12, backgroundColor: c.bg }}>
      <View style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: c.highlight, alignItems: 'center', justifyContent: 'center' }}><Icon name="storefront" size={34} color={c.highlightText} /></View>
      <Txt v="h2" style={{ textAlign: 'center' }}>Primero, crea tu negocio</Txt>
      <Txt tone="muted" style={{ textAlign: 'center', maxWidth: 340 }}>Con tu negocio tendrás agenda, clientes y a Doer trabajando para ti.</Txt>
      <Key primary icon="add" label="Crear mi negocio" onPress={onCreate} />
    </View>
  );
}
