import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { ICONS, IconKey, applyIcon, currentIcon, iconUrl, installLink } from '../../lib/appIcon';
import { isIOS } from '../../lib/push';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, Pressy, Sheet, Txt, useToast } from '../../ui';
import { tr } from '../../i18n';

/** Choose the app icon (five eras of the same design), like Telegram. The tab icon changes at once; the home-screen icon is set when CIFRA is added. */
export function AppIconSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const [sel, setSel] = useState<IconKey>('moderno');
  useEffect(() => { if (visible) setSel(currentIcon()); }, [visible]);
  const pick = (k: IconKey) => { setSel(k); applyIcon(k); };
  const copy = async () => { await Clipboard.setStringAsync(installLink(sel)); toast.show('Enlace copiado: ábrelo en Safari y añade CIFRA a la pantalla de inicio', 'success'); };
  const label = ICONS.find((i) => i.key === sel)?.label ?? '';
  return (
    <Sheet visible={visible} onClose={onClose} title="Icono de la app">
      <View style={{ gap: 14 }}>
        <Txt v="small" tone="muted">Elige cómo se ve CIFRA. Es el mismo diseño en cinco épocas.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {ICONS.map((i) => (
            <Pressy key={i.key} onPress={() => pick(i.key)} accessibilityRole="radio" accessibilityState={{ selected: sel === i.key }} accessibilityLabel={`${tr(i.label)}. ${tr(i.era)}`} scale={0.96}
              style={{ width: '30%', minWidth: 96, flexGrow: 1, alignItems: 'center', gap: 6, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: sel === i.key ? c.accent : c.border, backgroundColor: sel === i.key ? c.accentSoft : c.surface }}>
              <Image source={{ uri: iconUrl(i.key) }} style={{ width: 64, height: 64, borderRadius: 15 }} />
              <Txt v="smallStrong" numberOfLines={1}>{i.label}</Txt>
              {sel === i.key && <View style={{ position: 'absolute', top: 6, right: 6 }}><Icon name="checkmark-circle" size={18} color={c.accent} /></View>}
            </Pressy>
          ))}
        </View>
        <View style={{ gap: 8, padding: 12, borderRadius: 14, backgroundColor: c.sunken }}>
          <Txt v="smallStrong">{label}</Txt>
          <Txt v="caption" tone="muted">{ICONS.find((i) => i.key === sel)?.era}</Txt>
          <Txt v="caption" tone="muted">{isIOS() ? 'En iPhone el icono de la pantalla de inicio se fija al añadir la app: abre este enlace en Safari y pulsa Compartir → Añadir a pantalla de inicio.' : 'El icono de la pantalla de inicio se fija al instalar la app: abre este enlace e instálala de nuevo.'}</Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Copiar enlace" icon="copy" variant="secondary" style={{ flex: 1 }} onPress={copy} />
            <Button title="Abrir" icon="open-outline" style={{ flex: 1 }} onPress={() => { Linking.openURL(installLink(sel)).catch(() => {}); }} />
          </View>
        </View>
        <Button title="Listo" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}
