import { View } from 'react-native';
import { ScreenGuard } from '../features/chat/ScreenGuard';
import { Txt } from '../ui';
export default function P() { return <ScreenGuard><View style={{ flex: 1, backgroundColor: '#fff', padding: 40 }}><Txt v="h1">Chat secreto</Txt></View></ScreenGuard>; }
