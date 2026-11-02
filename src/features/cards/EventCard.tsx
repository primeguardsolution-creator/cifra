import { Image, Platform, View } from 'react-native';
import { Reaction } from '../../lib/api';
import { ChatEvent, RSVP, buildIcs } from '../../lib/chatCards';
import { fileArt } from '../../lib/fileKind';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Pressy, Txt, useToast } from '../../ui';
import { loc, t, tr } from '../../i18n';

const dur = (m: number) => (m < 60 ? t('{n} min', { n: m }) : m % 60 ? t('{h} h {m} min', { h: Math.floor(m / 60), m: m % 60 }) : t('{h} h', { h: m / 60 }));

/** An event in a chat: date, place, answer (going / maybe / can't) and add-to-calendar. Answers are the three reactions the app already allows. */
export function EventCard({ event, mine, me, reactions, onAnswer, uid }: { event: ChatEvent & { end: Date }; mine: boolean; me: string; reactions: Reaction[]; onAnswer: (emoji: string) => void; uid: string }) {
  const { c } = useTheme();
  const toast = useToast();
  const fg = mine ? c.bubbleOutText : c.bubbleInText; const sub = mine ? c.bubbleOutMeta : c.textMuted;
  const past = event.end.getTime() < Date.now();
  const mineAnswer = reactions.find((r) => r.user_id === me)?.emoji;
  const count = (e: string) => reactions.filter((r) => r.emoji === e).length;
  const addToCalendar = () => {
    if (Platform.OS !== 'web') { toast.show('Abre la app de calendario desde el navegador para añadirlo.', 'info'); return; }
    const url = URL.createObjectURL(new Blob([buildIcs(event, `${uid}@cifra`)], { type: 'text/calendar' }));
    const a = document.createElement('a'); a.href = url; a.download = `${event.title.replace(/[^\w\- ]+/g, '').trim() || 'evento'}.ics`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const answers: { key: string; emoji: string; label: string }[] = [{ key: 'going', emoji: RSVP.going, label: 'Voy' }, { key: 'maybe', emoji: RSVP.maybe, label: 'Quizá' }, { key: 'no', emoji: RSVP.no, label: 'No puedo' }];
  return (
    <View style={{ width: 260, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {fileArt.event ? <Image source={fileArt.event} resizeMode="contain" style={{ width: 48, height: 48 }} /> : <Icon name="calendar" size={30} color={sub} />}
        <View style={{ flex: 1 }}>
          <Txt v="smallStrong" numberOfLines={3} style={{ color: fg }}>{event.title}</Txt>
          <Txt v="caption" style={{ color: sub }}>{event.start.toLocaleString(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {dur(event.minutes)}</Txt>
        </View>
      </View>
      {event.place ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Icon name="location" size={14} color={sub} /><Txt v="caption" style={{ color: fg, flex: 1 }}>{event.place}</Txt></View> : null}
      {event.notes ? <Txt v="caption" style={{ color: sub }}>{event.notes}</Txt> : null}
      {past ? <Txt v="caption" style={{ color: sub }}>{tr('Este evento ya pasó')}</Txt> : (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {answers.map((a) => {
            const on = mineAnswer === a.emoji; const n = count(a.emoji);
            return (
              <Pressy key={a.key} onPress={() => onAnswer(a.emoji)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={tr(a.label)} scale={0.94}
                style={{ flex: 1, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, backgroundColor: on ? c.accent : mine ? 'rgba(255,255,255,0.14)' : c.sunken }}>
                <Txt v="caption" style={{ color: on ? c.accentText : fg }}>{tr(a.label)}{n ? ` · ${n}` : ''}</Txt>
              </Pressy>
            );
          })}
        </View>
      )}
      <Pressy onPress={addToCalendar} accessibilityRole="button" scale={0.95} style={{ alignSelf: 'flex-start' }}><Txt v="caption" style={{ color: mine ? c.bubbleOutText : c.accent, fontFamily: 'Inter_600SemiBold' }}>{tr('Añadir al calendario')}</Txt></Pressy>
    </View>
  );
}
