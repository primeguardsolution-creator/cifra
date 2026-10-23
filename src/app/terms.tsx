import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton, Txt } from '../ui';

const sections = [
  ['Uso de CIFRA', 'CIFRA es una aplicación de mensajería. Debes tener al menos 16 años y ser la persona titular del número de teléfono con el que te registras. No uses CIFRA para spam, acoso, fraude ni actividades ilegales.'],
  ['Tu cuenta', 'Cada número de teléfono admite una única cuenta. Eres responsable de mantener tu contraseña en secreto. Puedes cerrar sesión en cualquier momento.'],
  ['Espacio Business', 'Si creas un negocio, eres responsable del contenido que publicas, de tu catálogo y de las personas a las que das acceso a tu equipo. Las notas internas solo son visibles para tu equipo.'],
  ['Versión beta', 'Esta es una versión de pruebas. Pueden producirse cambios, interrupciones o borrado de datos de prueba. No la uses todavía para información crítica.'],
];

export default function Terms() {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 640, gap: 18 }}>
          <IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Txt v="h1">Términos de uso</Txt>
          {sections.map(([t, b]) => (<View key={t} style={{ gap: 6 }}><Txt v="h3">{t}</Txt><Txt tone="muted">{b}</Txt></View>))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
