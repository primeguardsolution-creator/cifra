import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, View } from 'react-native';
import { LinkPreview, fetchPreview, hostOf } from '../lib/linkPreview';
import { Icon, Pressy, Txt } from '../ui';

/**
 * Card for a link inside a post: loads the page's title / description / image a moment after it appears; if the page has
 * nothing to show (or we are offline) it stays a tappable chip with the domain. `dark` is for cards over photos and videos.
 */
export function LinkCard({ url, dark, compact }: { url: string; dark?: boolean; compact?: boolean }) {
  const [p, setP] = useState<LinkPreview | null | undefined>(undefined);
  useEffect(() => { let live = true; setP(undefined); fetchPreview(url).then((x) => live && setP(x)); return () => { live = false; }; }, [url]);
  const bg = dark ? 'rgba(0,0,0,0.62)' : 'rgba(127,127,127,0.14)';
  const fg = dark ? '#fff' : undefined;
  const open = () => { Linking.openURL(url).catch(() => {}); };
  return (
    <Pressy onPress={open} accessibilityRole="link" accessibilityLabel={`${p?.title ?? hostOf(url)}`} scale={0.98}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: bg, borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(127,127,127,0.25)', maxWidth: 420, alignSelf: 'center', width: '100%' }}>
      {p?.image && !compact ? <Image source={{ uri: p.image }} resizeMode="cover" style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: 'rgba(127,127,127,0.2)' }} /> : (
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(127,127,127,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          {p === undefined ? <ActivityIndicator size="small" color={fg} /> : <Icon name="link" size={18} color={fg ?? '#888'} />}
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="smallStrong" numberOfLines={2} style={fg ? { color: fg } : undefined}>{p?.title ?? hostOf(url)}</Txt>
        {p?.description && !compact ? <Txt v="caption" numberOfLines={2} tone={dark ? undefined : 'muted'} style={dark ? { color: 'rgba(255,255,255,0.75)' } : undefined}>{p.description}</Txt> : null}
        <Txt v="mono" numberOfLines={1} tone={dark ? undefined : 'faint'} style={dark ? { color: 'rgba(255,255,255,0.6)' } : undefined}>{(p?.site ?? hostOf(url)).toUpperCase()}</Txt>
      </View>
      <Icon name="open-outline" size={16} color={fg ?? '#888'} />
    </Pressy>
  );
}
