import * as Clipboard from 'expo-clipboard';
import { Linking, View } from 'react-native';
import { Place, mapsLink } from '../../lib/geo';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Pressy, Txt, useToast } from '../../ui';
import { t, tr } from '../../i18n';
import { MapPreview } from './MapPreview';

/** A shared location inside a message: map, label, and one tap to open it in the phone's map app. */
export function LocationCard({ place, mine }: { place: Place & { label: string }; mine: boolean }) {
  const { c } = useTheme();
  const toast = useToast();
  const fg = mine ? c.bubbleOutText : c.bubbleInText;
  const label = place.label === 'Ubicación' ? tr('Ubicación') : place.label;
  return (
    <View style={{ width: 250, gap: 8 }}>
      <Pressy onPress={() => Linking.openURL(mapsLink(place))} accessibilityRole="link" accessibilityLabel={t('Abrir {name} en mapas', { name: label })} scale={0.98}>
        <MapPreview lat={place.lat} lng={place.lng} width={250} height={150} />
      </Pressy>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="location" size={16} color={mine ? c.bubbleOutMeta : '#E5484D'} />
        <Txt v="smallStrong" numberOfLines={2} style={{ flex: 1, color: fg }}>{label}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Pressy onPress={() => Linking.openURL(mapsLink(place))} accessibilityRole="link" scale={0.95}><Txt v="caption" style={{ color: mine ? c.bubbleOutText : c.accent, fontFamily: 'Inter_600SemiBold' }}>{tr('Abrir en mapas')}</Txt></Pressy>
        <Pressy onPress={async () => { await Clipboard.setStringAsync(`${place.lat}, ${place.lng}`); toast.show('Coordenadas copiadas', 'success'); }} accessibilityRole="button" scale={0.95}><Txt v="caption" style={{ color: mine ? c.bubbleOutMeta : c.textMuted }}>{tr('Copiar coordenadas')}</Txt></Pressy>
      </View>
    </View>
  );
}
