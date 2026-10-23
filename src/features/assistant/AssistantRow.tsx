import { router, usePathname } from 'expo-router';
import { View } from 'react-native';
import { listTime } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Icon, Pressy, Txt } from '../../ui';
import { BotAvatar } from './BotAvatar';
import { BOT } from './knowledge';
import { plain, useAssistantState } from './store';
import { t, tr } from '../../i18n';

const INTRO = '👋 ¡Hola! Pregúntame cómo se hace cualquier cosa en CIFRA.';

/** The assistant's pinned row at the top of the Personal chat list. */
export function AssistantRow() {
  const { c } = useTheme();
  const path = usePathname();
  const st = useAssistantState();
  const last = st.msgs[st.msgs.length - 1];
  const unread = st.loaded && !st.seen;
  const preview = last ? `${last.from === 'me' ? tr('Tú: ') : ''}${plain(last.text)}` : INTRO;
  return (
    <Pressy
      onPress={() => router.push('/assistant')} scale={0.985} hoverStyle={{ backgroundColor: c.surfaceAlt }} accessibilityRole="button"
      accessibilityLabel={t('{name}, bot oficial. {preview}', { name: BOT.name, preview: tr(preview) }) + (unread ? tr('. 1 mensaje sin leer') : '')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: path === '/assistant' ? c.accentSoft : 'transparent' }}
    >
      <BotAvatar size={52} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1, fontFamily: unread ? 'Inter_700Bold' : 'Inter_600SemiBold' }}>{BOT.name}</Txt>
          <Icon name="checkmark-circle" size={15} tone="accent" />
          <View style={{ flex: 1 }} />
          <Icon name="pin" size={12} tone="faint" />
          {last && <Txt v="mono" tone={unread ? 'accent' : 'faint'}>{listTime(last.at)}</Txt>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt v="small" tone={unread ? 'text' : 'muted'} numberOfLines={1} style={{ flex: 1, fontFamily: unread ? 'Inter_500Medium' : 'Inter_400Regular' }}>{preview}</Txt>
          {unread ? <Badge count={1} /> : null}
        </View>
      </View>
    </Pressy>
  );
}

/** Should the pinned assistant row appear for this search text / filter? */
export function assistantMatches(q: string, filter: string, unread: boolean) {
  if (filter === 'groups' || filter === 'archived') return false;
  if (filter === 'unread') return unread;
  const n = q.trim().toLowerCase();
  return !n || 'maestro cifra asistente ayuda bot @maestro'.includes(n);
}
