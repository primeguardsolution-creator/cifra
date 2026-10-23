import { Image, Platform, StyleSheet, View } from 'react-native';
import { coverFocus, publicAvatarUrl } from '../lib/media';

/** A cover photo filling its parent, showing the part of the picture the owner chose (web; native keeps it centred). */
export function CoverImage({ path }: { path?: string | null }) {
  const url = publicAvatarUrl(path);
  if (!url) return null;
  if (Platform.OS === 'web') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: `50% ${coverFocus(path)}%` } as object]} />;
  }
  return <Image source={{ uri: url }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />;
}
