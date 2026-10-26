import { View } from 'react-native';
import { PollData } from '../../lib/api';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Pressy, Txt } from '../../ui';
import { t } from '../../i18n';

/** A poll inside a chat bubble: tap an option to vote (tap again to withdraw), bars show the counts. Only counts are shown, never who voted. */
export function PollCard({ poll, onVote, onClose, mine, light }: { poll: PollData; onVote: (optionId: string, on: boolean) => void; onClose: () => void; mine: boolean; light?: boolean }) {
  const { c } = useTheme();
  const total = poll.options.reduce((n, o) => n + o.votes, 0);
  const fg = light ? '#fff' : c.text;
  const sub = light ? 'rgba(255,255,255,0.75)' : c.textMuted;
  return (
    <View style={{ gap: 8, minWidth: 220 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="stats-chart" size={14} color={sub} /><Txt v="caption" style={{ color: sub }}>{poll.multiple ? 'ENCUESTA · VARIAS RESPUESTAS' : 'ENCUESTA'}</Txt></View>
      <Txt v="bodyStrong" style={{ color: fg }}>{poll.question}</Txt>
      {poll.options.map((o) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        return (
          <Pressy key={o.id} disabled={poll.closed} onPress={() => onVote(o.id, !o.mine)} accessibilityRole="button" accessibilityState={{ selected: o.mine }} accessibilityLabel={`${o.label}: ${o.votes}`} scale={0.98}
            style={{ borderRadius: 10, borderWidth: 1, borderColor: o.mine ? (light ? '#fff' : c.accent) : light ? 'rgba(255,255,255,0.35)' : c.border, overflow: 'hidden', minHeight: 40, justifyContent: 'center' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: light ? 'rgba(255,255,255,0.22)' : c.accentSoft }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
              <Icon name={o.mine ? (poll.multiple ? 'checkbox' : 'radio-button-on') : (poll.multiple ? 'square-outline' : 'radio-button-off')} size={16} color={o.mine ? (light ? '#fff' : c.accent) : sub} />
              <Txt style={{ flex: 1, color: fg }}>{o.label}</Txt>
              <Txt v="smallStrong" style={{ color: sub }}>{o.votes}</Txt>
            </View>
          </Pressy>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt v="caption" style={{ color: sub, flex: 1 }}>{poll.closed ? t('Cerrada · {n} personas votaron', { n: poll.voters }) : t('{n} personas han votado', { n: poll.voters })}</Txt>
        {poll.mine_created && !poll.closed && <Pressy onPress={onClose} accessibilityRole="button" scale={0.96}><Txt v="caption" style={{ color: light ? '#fff' : c.accent, textDecorationLine: 'underline' }}>Cerrar encuesta</Txt></Pressy>}
      </View>
    </View>
  );
}
