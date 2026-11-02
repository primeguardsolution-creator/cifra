import { ScrollView } from 'react-native';
import { ACTION_META, ChatAction } from '../../lib/actions';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Pressy, Txt } from '../../ui';
import { tr } from '../../i18n';

/** The business's quick actions above the message box (customer view of a business chat). */
export function ActionBar({ actions, onAction }: { actions: ChatAction[]; onAction: (a: ChatAction) => void }) {
  const { c } = useTheme();
  if (!actions.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }} accessibilityLabel={tr('Acciones del negocio')}>
      {actions.map((a, i) => (
        <Pressy key={`${a.type}-${i}`} onPress={() => onAction(a)} accessibilityRole="button" accessibilityLabel={tr(a.label)} scale={0.95}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.border }}>
          <Icon name={ACTION_META[a.type].icon} size={16} color={c.accentSoftText} />
          <Txt v="smallStrong" style={{ color: c.accentSoftText }}>{tr(a.label)}</Txt>
        </Pressy>
      ))}
    </ScrollView>
  );
}
