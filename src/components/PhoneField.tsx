import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Country, countries, countryMatches, countryName, flag } from '../lib/phone';
import { useTheme } from '../theme/ThemeProvider';
import { Field, Icon, Pressy, Sheet, Txt } from '../ui';
import { t, tr } from '../i18n';

type Props = { value: string; onChange: (v: string) => void; country: Country; onCountry: (c: Country) => void; label?: string; error?: string | null; onSubmit?: () => void; placeholder?: string };

export function PhoneField({ value, onChange, country, onCountry, label, error, onSubmit, placeholder = '600 123 456' }: Props) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = q.trim() ? countries.filter((x) => countryMatches(x, q)) : countries;
  return (
    <>
      <Field label={label} value={value} onChangeText={onChange} keyboardType="phone-pad" autoComplete="tel" placeholder={placeholder} error={error} returnKeyType="done" onSubmitEditing={onSubmit}
        left={<Pressy onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('País: {name}', { name: countryName(country) })} scale={0.94} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, borderRightWidth: 1, borderRightColor: c.border, height: 28 }}><Txt style={{ fontSize: 20 }}>{flag(country.iso)}</Txt><Txt v="bodyStrong">+{country.dial}</Txt><Icon name="chevron-down" size={14} tone="muted" /></Pressy>} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Elige el país" scroll={false} maxHeight={560}>
        <Field value={q} onChangeText={setQ} placeholder="Buscar país o prefijo" icon="search" />
        <ScrollView style={{ maxHeight: 400, marginTop: 10 }} keyboardShouldPersistTaps="handled">
          {list.map((x) => (
            <Pressy key={x.iso + x.dial} onPress={() => { onCountry(x); setOpen(false); setQ(''); }} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12 }}>
              <Txt style={{ fontSize: 24 }}>{flag(x.iso)}</Txt><Txt v="bodyStrong" style={{ flex: 1 }}>{countryName(x)}</Txt><Txt tone="muted">+{x.dial}</Txt>
            </Pressy>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}
