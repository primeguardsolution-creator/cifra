import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ProfileHero } from '../../../components/ProfileHero';
import { useCall } from '../../../features/calls/CallProvider';
import { PersonCard, blockUser, getProfiles, listBlocked, startDirectChat, unblockUser } from '../../../lib/api';
import { friendly } from '../../../lib/errors';
import { formatPhone } from '../../../lib/phone';
import { appUrl, shareText } from '../../../lib/share';
import { useAuth } from '../../../state/AuthProvider';
import { useTheme } from '../../../theme/ThemeProvider';
import { Card, ChatSkeleton, Divider, EmptyState, Icon, IconButton, IconName, Pressy, Txt, useToast } from '../../../ui';
import { loc, t } from '../../../i18n';

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressy onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scale={0.94} style={{ flex: 1, minWidth: 74, alignItems: 'center', gap: 7, paddingVertical: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
      <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={19} color={c.accentSoftText} /></View>
      <Txt v="caption">{label}</Txt>
    </Pressy>
  );
}

/** A person's profile, seen by someone who chats with them. */
export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const call = useCall();
  const [p, setP] = useState<PersonCard | null | undefined>(undefined);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getProfiles([id]).then((r) => live && setP(r[0] ?? null)).catch(() => live && setP(null));
    listBlocked().then((b) => live && setBlocked(b.includes(id))).catch(() => {});
    return () => { live = false; };
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/chats'));
  const message = async () => { setBusy(true); try { const cid = await startDirectChat(id); router.replace({ pathname: '/chat/[id]', params: { id: cid } }); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); } };
  const mine = user?.id === id;
  const since = p?.created_at ? new Date(p.created_at).toLocaleDateString(loc(), { month: 'long', year: 'numeric' }) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 60 }}>
        {p === undefined ? <View style={{ width: '100%', maxWidth: 640, padding: 16, paddingTop: 80 }}><ChatSkeleton rows={3} /></View> : p === null ? (
          <View style={{ paddingTop: 100 }}><EmptyState icon="person" title="Perfil no disponible" body="Solo puedes ver el perfil de personas con las que compartes un chat." action="Volver" onAction={back} /></View>
        ) : (
          <>
            <ProfileHero
              kind="person" name={p.display_name} seed={p.id} avatarPath={p.avatar_path} coverPath={p.cover_path} handle={p.username} bio={p.bio}
              badges={[{ icon: 'person', label: 'Personal' }, ...(since ? [{ icon: 'calendar' as IconName, label: t('En CIFRA desde {when}', { when: since }), tone: 'muted' as const }] : [])]}
              topLeft={<IconButton icon="chevron-back" label="Volver" onPress={back} glass />}
              topRight={p.username ? <IconButton icon="share-social" label="Compartir @usuario" glass onPress={async () => toast.show((await shareText(t('Escribe a {name} en CIFRA: @{u}', { name: p.display_name, u: p.username ?? '' }), appUrl())) === 'copied' ? 'Copiado' : 'Compartido', 'success')} /> : undefined}
            />
            <View style={{ width: '100%', maxWidth: 640, paddingHorizontal: 18, gap: 16, marginTop: 18 }}>
              {!mine && (
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <Action icon="chatbubble" label={busy ? '…' : 'Mensaje'} onPress={message} />
                  {call.supported && !blocked && <Action icon="call" label="Llamar" onPress={() => call.startCall({ id: p.id, name: p.display_name, avatar: p.avatar_path }, 'audio')} />}
                  {call.supported && !blocked && <Action icon="videocam" label="Vídeo" onPress={() => call.startCall({ id: p.id, name: p.display_name, avatar: p.avatar_path }, 'video')} />}
                </View>
              )}
              <Card>
                {p.username ? (
                  <>
                    <Pressy onPress={async () => { await Clipboard.setStringAsync(`@${p.username}`); toast.show('@usuario copiado', 'success'); }} scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
                      <Icon name="at" size={20} tone="accent" /><View style={{ flex: 1 }}><Txt v="bodyStrong">@{p.username}</Txt><Txt v="caption" tone="muted">Nombre de usuario · toca para copiar</Txt></View><Icon name="copy-outline" size={17} tone="faint" />
                    </Pressy>
                    <Divider inset={50} />
                  </>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
                  <Icon name={p.phone ? 'call' : 'eye-off'} size={20} tone="accent" />
                  <View style={{ flex: 1 }}><Txt v="bodyStrong">{p.phone ? formatPhone(p.phone) : 'Número oculto'}</Txt><Txt v="caption" tone="muted">{p.phone ? 'Teléfono' : 'Solo se muestra si la persona lo comparte contigo'}</Txt></View>
                </View>
              </Card>
              {!mine && (
                <Card>
                  <Pressy onPress={async () => { try { if (blocked) await unblockUser(user!.id, id); else await blockUser(user!.id, id); setBlocked(!blocked); toast.show(blocked ? 'Contacto desbloqueado' : 'Contacto bloqueado', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } }} scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
                    <Icon name={blocked ? 'checkmark-circle' : 'ban'} size={20} color={blocked ? c.accent : c.danger} />
                    <Txt v="bodyStrong" style={{ color: blocked ? c.accent : c.danger }}>{blocked ? 'Desbloquear contacto' : 'Bloquear contacto'}</Txt>
                  </Pressy>
                </Card>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
