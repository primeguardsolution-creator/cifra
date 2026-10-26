import { Redirect, Stack, usePathname } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { ChatsPane } from '../../components/ChatsPane';
import { Rail, TabBar, topLevel } from '../../components/Nav';
import { UpdateBanner } from '../../components/UpdateBanner';
import { AccountSafetyPrompt } from '../../features/auth/AccountSafety';
import { AppointmentReminders } from '../../features/agenda/Reminders';
import { useEffect } from 'react';
import { assistantStore } from '../../features/assistant/store';
import { useAuth } from '../../state/AuthProvider';
import { CallProvider } from '../../features/calls/CallProvider';
import { LockProvider } from '../../features/lock/LockProvider';
import { AttentionProvider } from '../../state/AttentionProvider';
import { ChatsProvider } from '../../state/ChatsProvider';
import { SpaceProvider } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';

import { WIDE } from '../../lib/layout';

export default function AppLayout() {
  const { ready, user } = useAuth();
  const { c } = useTheme();
  useEffect(() => { if (user) assistantStore.load(user.id); else assistantStore.reset(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (!user) return <Redirect href="/" />;
  return (
    <LockProvider>
      <SpaceProvider>
        <ChatsProvider>
          <AttentionProvider>
            <CallProvider>
              <Frame />
            </CallProvider>
          </AttentionProvider>
        </ChatsProvider>
      </SpaceProvider>
    </LockProvider>
  );
}

function Frame() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const path = usePathname();
  const wide = width >= WIDE;
  const chatRoute = path === '/chats' || path === '/inbox' || path === '/assistant' || path.startsWith('/chat/');
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
      {wide && <Rail />}
      {wide && chatRoute && (
        <View style={{ width: 392, borderRightWidth: 1, borderRightColor: c.border, backgroundColor: c.bg }}>
          <ChatsPane embedded />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <UpdateBanner />
        <AppointmentReminders />
        <AccountSafetyPrompt />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: wide ? 'none' : 'default' }} />
        </View>
        {!wide && topLevel.includes(path) && <TabBar />}
      </View>
    </View>
  );
}
