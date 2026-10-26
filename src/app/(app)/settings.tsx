import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { PersonCard, getProfiles, listBlocked, unblockUser } from '../../lib/api';
import { formatPhone } from '../../lib/phone';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { PIN_DIGITS, PinPad, useLock } from '../../features/lock/LockProvider';
import { Wallpaper } from '../../components/Wallpaper';
import { BotAvatar } from '../../features/assistant/BotAvatar';
import { BOT } from '../../features/assistant/knowledge';
import { accentOptions, wallpaperOptions } from '../../theme/tokens';
import { ModePreference, useTheme } from '../../theme/ThemeProvider';
import { Avatar, Card, Divider, Icon, IconName, Pressy, SectionLabel, Sheet, SheetRow, Toggle, Txt, useToast } from '../../ui';
import { updateMyProfile } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { SafetySheet, safetySummary } from '../../features/auth/AccountSafety';
import { RecoveryStatus, recoveryStatus } from '../../lib/recovery';
import { PushPrefs, PushStatus, disablePush, enablePush, getPushPrefs, pushStatus, setPushPrefs } from '../../lib/push';
import { pickWallpaperImage } from '../../lib/media';
import { getLocale, getLocalePref, setLocalePref, t, tr } from '../../i18n';

const langName: Record<'es' | 'en' | 'de', string> = { es: 'Español', en: 'English', de: 'Deutsch' };

function Row({ icon, title, sub, onPress, right, tone }: { icon: IconName; title: string; sub?: string; onPress?: () => void; right?: React.ReactNode; tone?: 'danger' }) {
  const { c } = useTheme();
  return (
    <Pressy onPress={onPress} disabled={!onPress} scale={0.99} hoverStyle={onPress ? { backgroundColor: c.surfaceAlt } : undefined} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: tone === 'danger' ? c.dangerSoft : c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={19} color={tone === 'danger' ? c.danger : c.accentSoftText} /></View>
      <View style={{ flex: 1 }}><Txt v="bodyStrong" tone={tone === 'danger' ? 'danger' : 'text'}>{title}</Txt>{sub ? <Txt v="caption" tone="muted">{sub}</Txt> : null}</View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} tone="faint" /> : null)}
    </Pressy>
  );
}

export default function Settings() {
  const { c, preference, setPreference, space, accent, setAccent, wallpaper, setWallpaper, wallpaperImage, setWallpaperImage } = useTheme();
  const lock = useLock();
  const [pinSheet, setPinSheet] = useState<null | 'new' | 'confirm' | 'off'>(null);
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinShake, setPinShake] = useState(0);
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { switchSpace, active } = useSpace();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blocked, setBlocked] = useState<PersonCard[]>([]);
  const [push, setPush] = useState<PushStatus>('unsupported');
  const [pushBusy, setPushBusy] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safety, setSafety] = useState<RecoveryStatus | null>(null);
  const [prefs, setPrefs] = useState<PushPrefs>({ personal: true, business: true });
  const [langSheet, setLangSheet] = useState(false);

  useEffect(() => { recoveryStatus().then(setSafety).catch(() => {}); }, []);
  useEffect(() => { if (Platform.OS === 'web') pushStatus().then((st) => { setPush(st); if (st === 'on') getPushPrefs().then(setPrefs); }).catch(() => {}); }, []);
  const openBlocked = async () => {
    setBlockedOpen(true);
    try { const ids = await listBlocked(); setBlocked(ids.length ? await getProfiles(ids) : []); } catch (e) { toast.show(friendly(e), 'error'); }
  };
  /** Personal and Business notifications are switched on and off separately; the device subscription lives while at least one is on. */
  const togglePush = async (space: 'personal' | 'business', on: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const fresh = push !== 'on';
      if (on && fresh) await enablePush();
      const next: PushPrefs = on && fresh ? { personal: space === 'personal', business: space === 'business' } : { ...prefs, [space]: on };
      if (!next.personal && !next.business) { await disablePush(); toast.show('Notificaciones desactivadas en este dispositivo', 'info'); setPrefs({ personal: true, business: true }); }
      else { await setPushPrefs(next); setPrefs(next); if (on) toast.show(space === 'business' ? 'Avisos de Business activados' : 'Avisos personales activados', 'success'); }
    } catch (e) {
      const m = String((e as Error).message);
      toast.show(m === 'needs_install' ? 'En iPhone: toca Compartir → «Añadir a pantalla de inicio» y abre CIFRA desde ese icono.' : m === 'denied' ? 'Las notificaciones están bloqueadas: actívalas en Ajustes del teléfono → CIFRA.' : m === 'not-configured' ? 'Las notificaciones aún no están activadas en el servidor.' : m === 'unsupported' ? 'Este navegador no admite notificaciones.' : friendly(e), m === 'needs_install' ? 'info' : 'error');
    } finally { setPush(await pushStatus().catch(() => 'unsupported' as PushStatus)); setPushBusy(false); }
  };
  const modes: { k: ModePreference; label: string; icon: IconName }[] = [{ k: 'auto', label: 'Auto', icon: 'phone-portrait' }, { k: 'light', label: 'Claro', icon: 'sunny' }, { k: 'dark', label: 'Oscuro', icon: 'moon' }];
  const pickMyWallpaper = async () => {
    if (wallpaperImage) { setWallpaper('image'); }
    try { const uri = await pickWallpaperImage(); if (uri) { setWallpaperImage(uri); setWallpaper('image'); toast.show('Fondo cambiado', 'success'); } } catch (e) { toast.show(friendly(e, 'No se pudo usar esa imagen.'), 'error'); }
  };
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: 560 }}>
          <Txt v="h1" style={{ marginBottom: 16 }}>Ajustes</Txt>

          <Pressy onPress={() => router.push('/profile')} scale={0.99} accessibilityRole="button" accessibilityLabel="Editar perfil" style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <Avatar name={profile?.display_name} seed={user?.id} path={profile?.avatar_path} size={68} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="h2" numberOfLines={1}>{profile?.display_name ?? '…'}</Txt>
              <Txt v="small" tone="muted">{formatPhone(profile?.phone ?? user?.phone)}</Txt>
              <Txt v="caption" tone="accent">Editar perfil y foto</Txt>
            </View>
            <Icon name="chevron-forward" size={18} tone="faint" />
          </Pressy>

          <Pressy onPress={() => router.push('/assistant')} scale={0.99} accessibilityRole="button" accessibilityLabel="Preguntar a Maestro CIFRA, el asistente" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: c.accentSoft }}>
            <BotAvatar size={44} />
            <View style={{ flex: 1 }}><Txt v="bodyStrong" style={{ color: c.accentSoftText }}>Pregunta a @{BOT.username}</Txt><Txt v="caption" style={{ color: c.accentSoftText }}>Tu asistente te explica cómo hacer cualquier cosa</Txt></View>
            <Icon name="chevron-forward" size={18} color={c.accentSoftText} />
          </Pressy>

          <SectionLabel>Espacios</SectionLabel>
          <Card>
            <Row icon={space === 'business' ? 'person' : 'storefront'} title={space === 'business' ? 'Cambiar a Personal' : 'Cambiar a Business'} sub={space === 'business' ? 'Tus chats y contactos' : active ? t('Gestiona {name}', { name: active.business.name }) : 'Crea tu negocio y atiende clientes'} onPress={() => switchSpace()} />
            <Divider inset={66} />
            <Row icon="business" title="Mi negocio" sub={active ? active.business.name : 'Aún no tienes uno'} onPress={() => router.push(active ? '/business' : '/business-create')} />
          </Card>

          <SectionLabel>Idioma</SectionLabel>
          <Card>
            <Row icon="language" title="Idioma" sub={getLocalePref() === 'auto' ? `${tr('Automático (según tu dispositivo)')} · ${langName[getLocale()]}` : langName[getLocale()]} onPress={() => setLangSheet(true)} />
          </Card>

          <SectionLabel>Apariencia</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {modes.map((m) => (
              <Pressy key={m.k} onPress={() => setPreference(m.k)} accessibilityRole="radio" accessibilityState={{ selected: preference === m.k }} scale={0.97} style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 18, backgroundColor: preference === m.k ? c.accent : c.surface, borderWidth: 1, borderColor: preference === m.k ? c.accent : c.border }}>
                <Icon name={m.icon} size={20} color={preference === m.k ? c.accentText : c.textMuted} /><Txt v="smallStrong" style={{ color: preference === m.k ? c.accentText : c.text }}>{m.label}</Txt>
              </Pressy>
            ))}
          </View>

          {space === 'personal' && (
            <>
              <SectionLabel>Personalizar</SectionLabel>
              <Card>
                <View style={{ padding: 16, gap: 12 }}>
                  <Txt v="smallStrong">Color de CIFRA</Txt>
                  <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
                    {accentOptions.map((o) => (
                      <Pressy key={o.key} onPress={() => setAccent(o.key)} haptic accessibilityRole="radio" accessibilityState={{ selected: accent === o.key }} accessibilityLabel={o.label} scale={0.85}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: o.swatch, alignItems: 'center', justifyContent: 'center', borderWidth: accent === o.key ? 3 : 0, borderColor: c.surface, shadowColor: o.swatch, shadowOpacity: accent === o.key ? 0.55 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}>
                        {accent === o.key && <Icon name="checkmark" size={22} color="#fff" />}
                      </Pressy>
                    ))}
                  </View>
                </View>
                <Divider />
                <View style={{ padding: 16, gap: 12 }}>
                  <Txt v="smallStrong">Fondo de los chats</Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                    {wallpaperOptions.map((o) => (
                      <Pressy key={o.key} onPress={() => setWallpaper(o.key)} haptic accessibilityRole="radio" accessibilityState={{ selected: wallpaper === o.key }} accessibilityLabel={o.label} scale={0.92} style={{ alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 70, height: 100, borderRadius: 16, overflow: 'hidden', borderWidth: wallpaper === o.key ? 3 : 1, borderColor: wallpaper === o.key ? c.accent : c.border, justifyContent: 'flex-end', padding: 6, gap: 4 }}>
                          <Wallpaper kind={o.key} small />
                          <View style={{ alignSelf: 'flex-start', width: 30, height: 10, borderRadius: 5, backgroundColor: c.bubbleIn, borderWidth: 1, borderColor: c.border }} />
                          <View style={{ alignSelf: 'flex-end', width: 34, height: 10, borderRadius: 5, backgroundColor: c.bubbleOut }} />
                        </View>
                        <Txt v="caption" tone={wallpaper === o.key ? 'accent' : 'muted'}>{o.label}</Txt>
                      </Pressy>
                    ))}
                    <Pressy onPress={pickMyWallpaper} haptic accessibilityRole="radio" accessibilityState={{ selected: wallpaper === 'image' }} accessibilityLabel="Usar mi propia imagen" scale={0.92} style={{ alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 70, height: 100, borderRadius: 16, overflow: 'hidden', borderWidth: wallpaper === 'image' ? 3 : 1.5, borderColor: wallpaper === 'image' ? c.accent : c.borderStrong, borderStyle: wallpaperImage ? 'solid' : 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: c.sunken }}>
                        {wallpaperImage ? <Wallpaper kind="image" small /> : null}
                        <Icon name={wallpaperImage ? 'swap-horizontal' : 'image'} size={24} color={wallpaperImage ? '#fff' : c.textMuted} />
                      </View>
                      <Txt v="caption" tone={wallpaper === 'image' ? 'accent' : 'muted'}>{wallpaperImage ? 'Mi imagen' : 'Subir imagen'}</Txt>
                    </Pressy>
                  </ScrollView>
                </View>
              </Card>
            </>
          )}

          <SectionLabel>Privacidad y avisos</SectionLabel>
          <Card>
            <Row icon="search" title="Descubrible por número" sub="Permite que te encuentren con tu teléfono" right={<Toggle value={profile?.discoverable ?? true} label="Descubrible por número" onChange={async (v) => { if (!user) return; try { await updateMyProfile(user.id, { discoverable: v }); await refreshProfile(); } catch (e) { toast.show(friendly(e), 'error'); } }} />} />
            <Divider inset={66} />
            <Row icon="ban" title="Contactos bloqueados" onPress={openBlocked} />
            <Divider inset={66} />
            <Row icon="star" title="Mensajes destacados" sub="Los que guardaste para encontrarlos rápido" onPress={() => router.push('/starred')} />
            <Divider inset={66} />
            <Row icon="calendar" title="Mis citas" sub="Invitaciones de negocios y citas aceptadas" onPress={() => router.push('/my-appointments')} />
            <Divider inset={66} /><Row icon="shield-checkmark" title="Seguridad de la cuenta" sub={safetySummary(safety) || 'Correo y código para recuperar tu acceso'} onPress={() => setSafetyOpen(true)} />
            {lock.available && <><Divider inset={66} /><Row icon="keypad" title="Bloqueo con PIN" sub={lock.enabled ? 'Activado · se bloquea tras 1 minuto fuera de la app' : t('Protege CIFRA con un PIN de {n} dígitos', { n: PIN_DIGITS })} right={<Toggle value={lock.enabled} label="Bloqueo con PIN" onChange={(v) => { setPinError(null); setFirstPin(''); setPinSheet(v ? 'new' : 'off'); }} />} /></>}
            {Platform.OS === 'web' && <><Divider inset={66} /><Row icon="notifications" title="Avisos de mensajes personales"
              sub={push === 'needs-install' ? 'En iPhone, añade CIFRA a la pantalla de inicio para recibirlas' : push === 'denied' ? 'Bloqueadas en los ajustes del teléfono' : push === 'unsupported' ? 'Tu navegador no las admite' : push === 'not-configured' ? 'Pendiente de activar en el servidor' : push === 'on' && prefs.personal ? 'Activados: te avisan aunque la app esté cerrada' : 'Chats, grupos y negocios que te escriben'}
              right={<Toggle value={push === 'on' && prefs.personal} onChange={(v) => togglePush('personal', v)} label="Avisos de mensajes personales" />} />
              {active && <><Divider inset={66} /><Row icon="storefront" title="Avisos de Business"
              sub={push === 'needs-install' ? 'En iPhone, añade CIFRA a la pantalla de inicio para recibirlas' : push === 'denied' ? 'Bloqueadas en los ajustes del teléfono' : push === 'unsupported' ? 'Tu navegador no las admite' : push === 'not-configured' ? 'Pendiente de activar en el servidor' : push === 'on' && prefs.business ? t('Activados: clientes que escriben a {name}', { name: active.business.name }) : 'Mensajes de clientes en tu negocio (con 💼)'}
              right={<Toggle value={push === 'on' && prefs.business} onChange={(v) => togglePush('business', v)} label="Avisos de Business" />} /></>}</>}
          </Card>

          <SectionLabel>Acerca de</SectionLabel>
          <Card>
            <Row icon="document-text" title="Términos de uso" onPress={() => router.push('/terms')} />
            <Divider inset={66} />
            <Row icon="shield-checkmark" title="Privacidad y seguridad" sub="Cifrado en tránsito y en reposo" onPress={() => router.push('/privacy')} />
            <Divider inset={66} />
            <Row icon="information-circle" title="CIFRA" sub={t('Versión {v} · beta', { v: version })} />
          </Card>

          <View style={{ marginTop: 22 }}>
            <Card><Row icon="log-out" title="Cerrar sesión" tone="danger" onPress={async () => { await signOut(); router.replace('/'); }} /></Card>
          </View>
        </View>
      </ScrollView>

      <Sheet visible={!!pinSheet} onClose={() => setPinSheet(null)} scroll={false}>
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          {pinSheet === 'new' && <PinPad title="Crea tu PIN" subtitle={t('Elige {n} dígitos que recuerdes', { n: PIN_DIGITS })} error={pinError} shake={pinShake} onComplete={(p) => { setFirstPin(p); setPinError(null); setPinSheet('confirm'); }} />}
          {pinSheet === 'confirm' && <PinPad title="Repite el PIN" subtitle="Para asegurarnos de que lo escribiste bien" error={pinError} shake={pinShake} onComplete={async (p) => { if (p === firstPin) { await lock.setPin(p); setPinSheet(null); toast.show('Bloqueo con PIN activado', 'success'); } else { setPinError('No coincide. Empieza de nuevo.'); setPinShake((n) => n + 1); setFirstPin(''); setPinSheet('new'); } }} />}
          {pinSheet === 'off' && <PinPad title="Desactivar el bloqueo" subtitle="Introduce tu PIN actual" error={pinError} shake={pinShake} onComplete={async (p) => { if (await lock.verify(p)) { await lock.disable(); setPinSheet(null); toast.show('Bloqueo desactivado', 'success'); } else { setPinError('PIN incorrecto'); setPinShake((n) => n + 1); } }} />}
        </View>
      </Sheet>

      <SafetySheet visible={safetyOpen} onClose={() => setSafetyOpen(false)} onChanged={setSafety} />
      <Sheet visible={langSheet} onClose={() => setLangSheet(false)} title="Elige el idioma de CIFRA">
        {([['auto', 'Automático (según tu dispositivo)'], ['es', 'Español'], ['en', 'English'], ['de', 'Deutsch']] as const).map(([k, label]) => (
          <SheetRow key={k} icon={k === 'auto' ? 'phone-portrait' : 'language'} label={label} right={getLocalePref() === k ? <Icon name="checkmark-circle" tone="accent" /> : undefined} onPress={() => { setLangSheet(false); setLocalePref(k); }} />
        ))}
      </Sheet>

      <Sheet visible={blockedOpen} onClose={() => setBlockedOpen(false)} title="Contactos bloqueados">
        {blocked.length === 0 ? <Txt tone="muted" style={{ paddingVertical: 20, textAlign: 'center' }}>No has bloqueado a nadie.</Txt> : blocked.map((p) => (
          <SheetRow key={p.id} icon="person" label={p.display_name} sub="Toca para desbloquear" onPress={async () => { if (!user) return; try { await unblockUser(user.id, p.id); setBlocked((b) => b.filter((x) => x.id !== p.id)); toast.show('Contacto desbloqueado', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } }} />
        ))}
      </Sheet>
    </View>
  );
}
