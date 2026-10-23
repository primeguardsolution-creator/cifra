import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { CoverPicker, PhotoPicker } from '../../components/PhotoPicker';
import { ProfileHero } from '../../components/ProfileHero';
import { updateMyProfile } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { appUrl, shareText } from '../../lib/share';
import { formatPhone } from '../../lib/phone';
import { useAuth } from '../../state/AuthProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Field, Icon, IconButton, Toggle, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

export default function Profile() {
  const { c } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [discoverable, setDiscoverable] = useState(true);
  const [hidePhone, setHidePhone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name); setBio(profile.bio ?? ''); setUsername(profile.username ?? ''); setDiscoverable(profile.discoverable); setHidePhone(profile.hide_phone);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;
  const dirty = !!profile && (name.trim() !== profile.display_name || bio.trim() !== (profile.bio ?? '') || username.trim().replace(/^@/, '').toLowerCase() !== (profile.username ?? '') || discoverable !== profile.discoverable || hidePhone !== profile.hide_phone);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Tu nombre no puede estar vacío.');
    const u = username.trim().replace(/^@/, '').toLowerCase();
    if (u && !/^[a-z0-9_]{3,32}$/.test(u)) return setError('El usuario debe tener 3–32 caracteres: letras, números o guion bajo.');
    setSaving(true);
    try { await updateMyProfile(user.id, { display_name: name, bio, username: u, discoverable, hide_phone: hidePhone }); await refreshProfile(); toast.show('Perfil guardado', 'success'); }
    catch (e) { setError(friendly(e, 'No se pudo guardar el perfil.')); } finally { setSaving(false); }
  };

  const savePhoto = async (path: string | null) => { await updateMyProfile(user.id, { avatar_path: path }); await refreshProfile(); };
  const saveCover = async (path: string | null) => { await updateMyProfile(user.id, { cover_path: path }); await refreshProfile(); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <ProfileHero
            kind="person" compact name={name || profile?.display_name || '…'} seed={user.id} avatarPath={profile?.avatar_path} coverPath={profile?.cover_path} handle={username.replace(/^@/, '') || null} bio={bio.trim() || null}
            badges={[{ icon: 'person', label: 'Personal' }, { icon: hidePhone ? 'eye-off' : 'call', label: hidePhone ? 'Número oculto' : 'Número visible', tone: 'muted' }]}
            topLeft={<IconButton icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} glass />}
            bottomRight={<CoverPicker path={profile?.cover_path} folder={user.id} onChange={saveCover} light />}
          />
          <View style={{ width: '100%', maxWidth: 520, gap: 18, padding: 20 }}>
            <Txt v="caption" tone="faint" style={{ textAlign: 'center' }}>Así te ven las personas con las que chateas</Txt>
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 4 }}>
              <PhotoPicker name={name || profile?.display_name} seed={user.id} path={profile?.avatar_path} folder={user.id} onChange={savePhoto} size={88} />
              <Txt v="small" tone="muted">Toca la foto para cambiarla</Txt>
            </View>

            <Field label="Nombre" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" />
            <Field label="Info" value={bio} onChangeText={setBio} maxLength={140} placeholder="Cuéntales algo sobre ti" multiline />
            <Field label="Nombre de usuario (opcional)" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="usuario" left={<Txt tone="muted">@</Txt>} hint="Único en CIFRA. Con tu @usuario te encuentran sin necesitar tu teléfono." />
            {profile?.username ? <Button title={t('Compartir @{u}', { u: profile.username ?? '' })} icon="share-social" variant="soft" size="sm" full={false} onPress={async () => toast.show((await shareText(t('Escríbeme en CIFRA: @{u}', { u: profile.username ?? '' }), appUrl())) === 'copied' ? 'Copiado' : 'Compartido', 'success')} /> : null}

            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <Icon name="call" size={20} tone="accent" />
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">{formatPhone(profile?.phone ?? user.phone)}</Txt>
                  <Txt v="caption" tone="muted">{profile?.phone_verified ? 'Número verificado por SMS' : 'Tu número es tu identidad: una cuenta por número'}</Txt>
                </View>
                {profile?.phone_verified && <Icon name="checkmark-circle" size={20} tone="accent" />}
              </View>
            </Card>

            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <Icon name="search" size={20} tone="accent" />
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">Que me encuentren por mi número</Txt>
                  <Txt v="caption" tone="muted">Si lo desactivas, solo hablarán contigo quienes ya tengan un chat contigo.</Txt>
                </View>
                <Toggle value={discoverable} onChange={setDiscoverable} label="Descubrible por número" />
              </View>
            </Card>

            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <Icon name="eye-off" size={20} tone="accent" />
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">Ocultar mi número</Txt>
                  <Txt v="caption" tone="muted">Tus contactos y grupos verán tu nombre y @usuario, pero nunca tu teléfono.</Txt>
                </View>
                <Toggle value={hidePhone} onChange={setHidePhone} label="Ocultar mi número" />
              </View>
            </Card>

            {error && <Txt v="small" tone="danger" accessibilityLiveRegion="polite">{error}</Txt>}
            <Button title="Guardar cambios" size="lg" loading={saving} disabled={!dirty} onPress={save} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
