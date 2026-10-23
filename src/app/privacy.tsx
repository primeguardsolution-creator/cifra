import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton, Txt } from '../ui';

const sections = [
  ['Qué guardamos', 'Tu número de teléfono, tu nombre y foto de perfil, tus contactos guardados y tus mensajes y archivos, para poder entregarlos a quien corresponde.'],
  ['Quién puede ver tus datos', 'Solo las personas de cada conversación ven sus mensajes. Otras personas solo pueden encontrarte por tu número exacto, y puedes desactivarlo en Ajustes → Privacidad. Los negocios nunca ven tu número si no les escribes.'],
  ['Cómo se protegen', 'Las comunicaciones viajan cifradas (TLS) y los datos se almacenan cifrados en reposo. Importante: CIFRA todavía no ofrece cifrado de extremo a extremo; el servicio puede técnicamente acceder al contenido almacenado. No incluimos contenido de mensajes en registros ni analítica.'],
  ['Tus derechos', 'Puedes editar tu perfil, bloquear contactos y borrar tus mensajes. Para exportar o eliminar tu cuenta durante la beta, escríbenos y lo gestionamos manualmente.'],
];

export default function Privacy() {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 640, gap: 18 }}>
          <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Txt v="h1">Privacidad</Txt>
          {sections.map(([t, b]) => (<View key={t} style={{ gap: 6 }}><Txt v="h3">{t}</Txt><Txt tone="muted">{b}</Txt></View>))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
