import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Logo, Txt } from '../ui';

export function NoChatSelected() {
  const { c, space } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: c.surfaceAlt, padding: 40 }}>
      <Logo size={88} />
      <Txt v="h1" style={{ textAlign: 'center' }}>{space === 'business' ? 'Atiende a tus clientes' : 'Tus conversaciones, tu espacio'}</Txt>
      <Txt tone="muted" style={{ textAlign: 'center', maxWidth: 380 }}>{space === 'business' ? 'Elige una conversación de la bandeja para responder, asignarla o dejar una nota interna.' : 'Elige un chat para empezar o escribe a alguien nuevo con su número de teléfono.'}</Txt>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 }}><Icon name="lock-closed" size={13} tone="faint" /><Txt v="caption" tone="faint">Cifrado en tránsito y en reposo</Txt></View>
    </View>
  );
}
