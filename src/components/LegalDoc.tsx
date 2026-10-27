import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLocale, tr } from '../i18n';
import { COMPANY, Doc, Lang } from '../legal/company';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton, Txt } from '../ui';

/** A long legal text (terms or privacy) in the app's language, with a table of contents. */
export function LegalDoc({ docs }: { docs: Record<Lang, Doc> }) {
  const { c } = useTheme();
  const lang = (['es', 'en', 'de'] as const).includes(getLocale() as Lang) ? (getLocale() as Lang) : 'es';
  const doc = docs[lang];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20, paddingBottom: 60 }}>
        <View style={{ width: '100%', maxWidth: 720, gap: 16 }}>
          <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Txt v="h1">{doc.title}</Txt>
          <Txt v="caption" tone="muted">{tr('Última actualización')}: {COMPANY.updated}</Txt>
          {doc.intro.map((t, i) => <Txt key={i} tone="muted">{t}</Txt>)}
          <View style={{ gap: 4, paddingVertical: 8 }}>
            {doc.sections.map((s) => <Txt key={s.h} v="small" tone="accent">{s.h}</Txt>)}
          </View>
          {doc.sections.map((s) => (
            <View key={s.h} style={{ gap: 8, paddingTop: 8 }}>
              <Txt v="h3">{s.h}</Txt>
              {s.p.map((t, i) => (
                t.startsWith('• ')
                  ? <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}><Txt tone="muted">•</Txt><Txt tone="muted" style={{ flex: 1 }}>{t.slice(2)}</Txt></View>
                  : <Txt key={i} tone="muted" style={t.endsWith(':') ? { fontFamily: 'Inter_600SemiBold' } : undefined}>{t}</Txt>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
