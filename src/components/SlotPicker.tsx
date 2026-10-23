import { createElement, useMemo } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';
import { addDays, sameDay, startOfDay } from '../lib/biz';
import { Pressy, Txt } from '../ui';
import { loc } from '../i18n';

const times = Array.from({ length: 26 }, (_, i) => ({ h: 8 + Math.floor(i / 2), m: (i % 2) * 30 }));

/** Date + time without typing: next two weeks as chips, then a grid of half-hour slots. Web also offers a free date-time field. */
export function SlotPicker({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const { c, r } = useTheme();
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(startOfDay(new Date()), i)), []);
  const day = value ? startOfDay(value) : null;
  const pickDay = (d: Date) => { const n = new Date(d); n.setHours(value?.getHours() ?? 10, value?.getMinutes() ?? 0, 0, 0); onChange(n); };
  const pickTime = (h: number, m: number) => { const n = new Date(day ?? startOfDay(new Date())); n.setHours(h, m, 0, 0); onChange(n); };
  const past = (h: number, m: number) => { if (!day) return false; const n = new Date(day); n.setHours(h, m, 0, 0); return n.getTime() < Date.now(); };
  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d) => {
          const on = !!day && sameDay(d, day);
          return (
            <Pressy key={d.toISOString()} onPress={() => pickDay(d)} accessibilityRole="button" accessibilityState={{ selected: on }} scale={0.94} style={{ width: 58, paddingVertical: 10, alignItems: 'center', gap: 2, borderRadius: r(16), backgroundColor: on ? c.accent : c.surface, borderWidth: 1, borderColor: on ? c.accent : c.border }}>
              <Txt style={{ fontSize: 11, lineHeight: 14, fontFamily: font.mono, color: on ? c.accentText : c.textFaint, textTransform: 'uppercase' }}>{d.toLocaleDateString(loc(), { weekday: 'short' }).replace('.', '')}</Txt>
              <Txt style={{ fontSize: 20, lineHeight: 24, fontFamily: font.display, color: on ? c.accentText : c.text }}>{d.getDate()}</Txt>
              <Txt style={{ fontSize: 10, lineHeight: 12, color: on ? c.accentText : c.textMuted }}>{d.toLocaleDateString(loc(), { month: 'short' }).replace('.', '')}</Txt>
            </Pressy>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {times.map(({ h, m }) => {
          const on = !!value && value.getHours() === h && value.getMinutes() === m;
          const dis = past(h, m);
          return (
            <Pressy key={`${h}:${m}`} disabled={dis || !day} onPress={() => pickTime(h, m)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: dis }} scale={0.94} style={{ width: 66, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: r(12), backgroundColor: on ? c.accent : c.surface, borderWidth: 1, borderColor: on ? c.accent : c.border, opacity: dis || !day ? 0.35 : 1 }}>
              <Txt v="smallStrong" style={{ color: on ? c.accentText : c.text }}>{`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`}</Txt>
            </Pressy>
          );
        })}
      </View>
      {Platform.OS === 'web' && createElement('input', {
        type: 'datetime-local', 'aria-label': 'Otra fecha y hora',
        value: value ? new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        onChange: (e: { target: { value: string } }) => { if (e.target.value) onChange(new Date(e.target.value)); },
        style: { height: 44, borderRadius: r(12), border: `1.5px solid ${c.border}`, padding: '0 12px', fontSize: 15, background: c.surface, color: c.text, fontFamily: font.medium },
      })}
    </View>
  );
}
