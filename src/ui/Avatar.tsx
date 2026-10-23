import { useState } from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { avatarTints, font } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Txt } from './Txt';
import { Icon } from './Icon';
import { publicAvatarUrl } from '../lib/media';

function hash(seed: string) { let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0; return Math.abs(h); }
export function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

type Props = { name?: string | null; seed?: string; path?: string | null; size?: number; business?: boolean; group?: boolean; ring?: boolean };

export function Avatar({ name, seed, path, size = 48, business, group, ring }: Props) {
  const { space, incognito } = useTheme();
  // Incognito rooms are black & white: only real photos keep their colour, generated avatars go grey.
  const tint: [string, string] = incognito ? ['#5A5A5A', '#1E1E1E'] : avatarTints[hash(seed ?? name ?? '?') % avatarTints.length];
  // Personal avatars are soft squircles (not circles); Business ones are crisp rounded squares.
  const radius = space === 'business' ? size * 0.16 : business ? size * 0.2 : size * 0.38;
  const [broken, setBroken] = useState(false);
  const uri = broken ? null : publicAvatarUrl(path);
  const inner = (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} onError={() => setBroken(true)} style={{ width: size, height: size }} /> : (
        <LinearGradient colors={business ? ['#17231F', '#3A4A43'] : tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', inset: 0, width: size, height: size }} />
      )}
      {!uri && (group ? <Icon name="people" size={size * 0.46} color="#fff" /> : business ? <Icon name="storefront" size={size * 0.46} color="#F6EBCF" /> : <Txt style={{ color: '#fff', fontFamily: font.semibold, fontSize: size * 0.36, lineHeight: size * 0.44 }}>{initials(name)}</Txt>)}
    </View>
  );
  if (!ring) return inner;
  return <View style={{ padding: 2.5, borderRadius: radius + 3, borderWidth: 2, borderColor: '#1FA67A' }}>{inner}</View>;
}
