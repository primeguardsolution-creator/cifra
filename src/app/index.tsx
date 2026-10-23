import { Redirect, router } from 'expo-router';
import { Animated, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { useAuth } from '../state/AuthProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Icon, Logo, Txt, Wordmark } from '../ui';

const points = [
  { icon: 'call' as const, title: 'Tu número es tu cuenta', body: 'Un registro por teléfono, como en las apps que ya usas. Sin correos, sin complicaciones.' },
  { icon: 'swap-horizontal' as const, title: 'Personal y Business, a un toque', body: 'Cambia de espacio con un botón. Cada uno con su bandeja, su ritmo y su identidad.' },
  { icon: 'shield-checkmark' as const, title: 'Privado por diseño', body: 'Cada conversación solo la ven sus participantes. Tú decides quién te encuentra.' },
];

export default function Welcome() {
  const { ready, user } = useAuth();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(rise, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }).start(); }, [rise]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (user) return <Redirect href="/chats" />;

  const anim = { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -120, right: -140, width: 480, height: 480, borderRadius: 240, backgroundColor: c.accentSoft, opacity: 0.9 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -160, left: -120, width: 420, height: 420, borderRadius: 210, backgroundColor: c.accent, opacity: 0.07 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
          <View style={{ width: '100%', maxWidth: wide ? 1040 : 520, flex: 1 }}>
            <View style={{ paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Wordmark size={17} />
              <Button title="Entrar" variant="ghost" size="sm" full={false} onPress={() => router.push({ pathname: '/auth', params: { mode: 'signIn' } })} />
            </View>

            <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: wide ? 64 : 28, justifyContent: 'center', paddingVertical: wide ? 40 : 28 }}>
              <Animated.View style={[{ flex: wide ? 1 : undefined }, anim]}>
                <View style={{ marginBottom: 28 }}><Logo size={wide ? 96 : 84} /></View>
                <Txt v="mono" tone="accent" style={{ marginBottom: 14 }}>MENSAJERÍA, A TU MANERA</Txt>
                <Txt v="display" style={{ fontSize: wide ? 56 : 40, lineHeight: wide ? 60 : 44, letterSpacing: wide ? -2 : -1.4 }}>Un espacio para tu vida.{'\n'}Otro para tu negocio.</Txt>
                <Txt tone="muted" style={{ fontSize: 18, lineHeight: 27, marginTop: 18, maxWidth: 480 }}>Chats rápidos y privados, con un botón para pasar de lo personal a lo profesional sin mezclar nada.</Txt>
                <View style={{ marginTop: 30, gap: 12, maxWidth: 420 }}>
                  <Button title="Crear mi cuenta" size="lg" iconRight="arrow-forward" onPress={() => router.push({ pathname: '/auth', params: { mode: 'register' } })} />
                  <Button title="Ya tengo cuenta" variant="secondary" size="lg" onPress={() => router.push({ pathname: '/auth', params: { mode: 'signIn' } })} />
                </View>
              </Animated.View>

              <Animated.View style={[{ flex: wide ? 1 : undefined, gap: 12 }, anim]}>
                {points.map((p) => (
                  <View key={p.title} style={{ flexDirection: 'row', gap: 16, padding: 18, backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.border }}>
                    <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={p.icon} size={22} color={c.accentSoftText} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt v="h3">{p.title}</Txt>
                      <Txt v="small" tone="muted">{p.body}</Txt>
                    </View>
                  </View>
                ))}
              </Animated.View>
            </View>

            <Txt v="caption" tone="faint" style={{ textAlign: 'center', paddingBottom: 12 }}>Al continuar aceptas los <Txt v="caption" tone="accent" onPress={() => router.push('/terms')}>términos</Txt> y la <Txt v="caption" tone="accent" onPress={() => router.push('/privacy')}>política de privacidad</Txt>.</Txt>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
