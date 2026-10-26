import { initMonitoring, reportError } from '../lib/monitoring';
import { TopScrim } from '../components/TopScrim';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { SpecialElite_400Regular } from '@expo-google-fonts/special-elite';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../state/AuthProvider';
import { I18nProvider, tr } from '../i18n';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { ToastProvider } from '../ui';

initMonitoring();

/** Anything that breaks while drawing a screen lands here: it is reported (without personal data) and the person can try again. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => { reportError(error, 'render'); }, [error]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28, backgroundColor: '#0E0E16' }}>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{tr('Algo salió mal')}</Text>
      <Text style={{ color: '#B9B9C8', fontSize: 15, textAlign: 'center', maxWidth: 320 }}>{tr('Ya nos llegó el aviso del error. Inténtalo de nuevo.')}</Text>
      <Pressable onPress={retry} accessibilityRole="button" style={{ backgroundColor: '#7C52E0', paddingHorizontal: 22, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>{tr('Reintentar')}</Text></Pressable>
    </View>
  );
}

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { c, mode } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'fade' }} />
      <TopScrim />
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, GeistMono_500Medium, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, SpecialElite_400Regular });
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
