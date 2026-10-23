import { Redirect } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { ChatsPane } from '../../components/ChatsPane';
import { NoChatSelected } from '../../components/NoChatSelected';
import { WIDE } from '../../lib/layout';
import { useTheme } from '../../theme/ThemeProvider';

export default function Chats() {
  const { width } = useWindowDimensions();
  const { space } = useTheme();
  if (space === 'business') return <Redirect href="/inbox" />;
  return width >= WIDE ? <NoChatSelected /> : <ChatsPane />;
}
