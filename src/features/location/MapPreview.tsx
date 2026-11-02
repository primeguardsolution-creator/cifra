import { Image, Linking, View } from 'react-native';
import { tilesFor } from '../../lib/geo';
import { Icon, Txt } from '../../ui';

/** A small static map (OpenStreetMap tiles) centred on a point, with a pin. */
export function MapPreview({ lat, lng, width, height, zoom = 16, radius = 12 }: { lat: number; lng: number; width: number; height: number; zoom?: number; radius?: number }) {
  const tiles = tilesFor(lat, lng, zoom, width, height);
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#E4E7EA' }} accessibilityRole="image" accessibilityLabel={`${lat.toFixed(5)}, ${lng.toFixed(5)}`}>
      {tiles.map((t) => <Image key={t.key} source={{ uri: t.url }} style={{ position: 'absolute', left: t.left, top: t.top, width: 256, height: 256 }} />)}
      <View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - 16, top: height / 2 - 32, width: 32, height: 32, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ position: 'absolute', bottom: -2, width: 14, height: 6, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        <Icon name="location" size={34} color="#E5484D" />
      </View>
      <Txt onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')} accessibilityRole="link" style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 9, lineHeight: 12, color: '#333', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 4, borderRadius: 3 }}>© OpenStreetMap</Txt>
    </View>
  );
}
