import { ActivityIndicator, Image, View } from 'react-native';
import { bytes } from '../../lib/format';
import { fileArt, fileKind, fileKindMeta, isViewable } from '../../lib/fileKind';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Pressy, Txt } from '../../ui';
import { t, tr } from '../../i18n';

/** A shared file as a card: 3D art for its kind (or a coloured tile until the art exists), name, kind, size, and what a tap does. */
export function FileCard({ name, mime, size, pending, mine, hasText, onPress }: { name?: string | null; mime?: string | null; size?: number | null; pending?: boolean; mine: boolean; hasText?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const kind = fileKind(name, mime); const meta = fileKindMeta[kind]; const art = fileArt[kind];
  const fg = mine ? c.bubbleOutText : c.bubbleInText;
  const viewable = isViewable(name, mime);
  return (
    <Pressy onPress={onPress} scale={0.98} accessibilityRole="button" accessibilityLabel={t('{action} {name}', { action: tr(viewable ? 'Ver' : 'Abrir'), name: name ?? tr('archivo') })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: mine ? 'rgba(255,255,255,0.12)' : c.surfaceAlt, minWidth: 230, marginBottom: hasText ? 6 : 0 }}>
      {art
        ? <Image source={art} resizeMode="contain" style={{ width: 52, height: 52 }} />
        : <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: meta.color, alignItems: 'center', justifyContent: 'center' }}>{pending ? <ActivityIndicator color="#fff" /> : <Icon name={meta.icon} size={22} color="#fff" />}</View>}
      <View style={{ flex: 1 }}>
        <Txt v="smallStrong" numberOfLines={2} style={{ color: fg }}>{name ?? tr('Archivo')}</Txt>
        <Txt v="caption" style={{ color: mine ? c.bubbleOutMeta : c.textMuted }}>{[tr(meta.label), bytes(size)].filter(Boolean).join(' · ')}</Txt>
        <Txt v="caption" style={{ color: mine ? c.bubbleOutMeta : c.accent, fontFamily: 'Inter_600SemiBold' }}>{viewable ? tr('Toca para ver') : tr('Toca para abrir')}</Txt>
      </View>
    </Pressy>
  );
}
