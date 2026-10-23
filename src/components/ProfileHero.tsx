import { LinearGradient } from 'expo-linear-gradient';
import { CoverImage } from './CoverImage';
import { Image, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { publicAvatarUrl } from '../lib/media';
import { useTheme } from '../theme/ThemeProvider';
import { avatarTints, bizAccentOptions } from '../theme/tokens';
import { Avatar, Icon, IconName, Txt } from '../ui';

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

export type HeroBadge = { icon: IconName; label: string; tone?: 'accent' | 'warm' | 'muted' };

/**
 * The profile "cover": same component for your own profile, a friend's and a business, but each wears its own look.
 * By default people get a soft gradient from their own colours and businesses an ink slab with a signal stripe in the
 * business colour; both can replace it with their own cover photo (`coverPath`). `bottomRight` hosts the cover picker.
 */
export function ProfileHero({ kind, name, seed, avatarPath, coverPath, accent, handle, tagline, bio, badges = [], topLeft, topRight, bottomRight, compact }: {
  kind: 'person' | 'business'; name: string; seed: string; avatarPath?: string | null; coverPath?: string | null; accent?: string | null; handle?: string | null; tagline?: string | null; bio?: string | null;
  badges?: HeroBadge[]; topLeft?: React.ReactNode; topRight?: React.ReactNode; bottomRight?: React.ReactNode; compact?: boolean;
}) {
  const { c, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const tint = avatarTints[hash(seed) % avatarTints.length];
  const biz = kind === 'business';
  const height = (compact ? 110 : 168) + insets.top + (coverPath ? 40 : 0);
  const web = Platform.OS === 'web';
  const cover = publicAvatarUrl(coverPath);
  const stripe = bizAccentOptions.find((o) => o.key === accent)?.swatch ?? '#F5A524';
  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <View style={{ width: '100%', height, overflow: 'hidden', backgroundColor: biz ? '#101009' : tint[1] }}>
        {cover ? (
          <>
            <CoverImage path={coverPath} />
            <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.25)']} style={{ position: 'absolute', inset: 0 } as object} />
          </>
        ) : biz ? (
          <>
            <View style={{ position: 'absolute', inset: 0, backgroundColor: '#101009' } as object} />
            <View style={{ position: 'absolute', left: -40, right: -40, bottom: 28, height: 22, backgroundColor: stripe, transform: [{ rotate: '-4deg' }] }} />
            <View style={{ position: 'absolute', left: -40, right: -40, bottom: 8, height: 8, backgroundColor: 'rgba(255,255,255,0.14)', transform: [{ rotate: '-4deg' }] }} />
            {web && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '28px 28px' } as object} />}
          </>
        ) : (
          <>
            <LinearGradient colors={[tint[0], tint[1], mode === 'dark' ? '#000' : c.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', inset: 0 } as object} />
            <View style={{ position: 'absolute', right: -60, top: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.13)' }} />
            <View style={{ position: 'absolute', left: -30, bottom: -70, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          </>
        )}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' }} pointerEvents="box-none">
          <View>{topLeft}</View><View>{topRight}</View>
        </View>
        {bottomRight && <View style={{ position: 'absolute', right: 12, bottom: compact ? 48 : 60 }}>{bottomRight}</View>}
      </View>
      <View style={{ width: '100%', maxWidth: 640, paddingHorizontal: 18, marginTop: -(compact ? 40 : 52), gap: 10 }}>
        <View style={{ alignSelf: 'flex-start', padding: 4, borderRadius: biz ? 14 : 38, backgroundColor: c.bg }}>
          <Avatar name={name} seed={seed} path={avatarPath} size={compact ? 80 : 100} business={biz} />
        </View>
        <View style={{ gap: 4 }}>
          <Txt v="h1" style={{ fontSize: compact ? 24 : 30, lineHeight: compact ? 30 : 36 }}>{name}</Txt>
          {(handle || tagline) && <Txt tone="muted">{[handle && `@${handle}`, tagline].filter(Boolean).join(' · ')}</Txt>}
        </View>
        {badges.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {badges.map((b) => {
              const bg = b.tone === 'warm' ? c.warningSoft : b.tone === 'muted' ? c.sunken : c.accentSoft;
              const fg = b.tone === 'warm' ? c.warning : b.tone === 'muted' ? c.textMuted : c.accentSoftText;
              return <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, height: 28, borderRadius: biz ? 5 : 14, backgroundColor: bg }}><Icon name={b.icon} size={13} color={fg} /><Txt v="caption" style={{ color: fg }}>{b.label}</Txt></View>;
            })}
          </View>
        )}
        {bio ? <Txt style={{ marginTop: 2 }}>{bio}</Txt> : null}
      </View>
    </View>
  );
}
