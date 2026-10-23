import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhoneField } from '../../components/PhoneField';
import { CoverPicker, PhotoPicker } from '../../components/PhotoPicker';
import { publicAvatarUrl } from '../../lib/media';
import { bizAccentOptions } from '../../theme/tokens';
import { BusinessRole, QuickReply, TeamMember, addQuickReply, addTeamMember, deleteQuickReply, listQuickReplies, listTeam, removeTeamMember, setTeamRole, updateBusiness } from '../../lib/api';
import { canManage, categories, roleLabel, roleRank } from '../../lib/business';
import { friendly } from '../../lib/errors';
import { Country, countries, formatPhone, toE164 } from '../../lib/phone';
import { appUrl, shareText } from '../../lib/share';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Button, Card, Chip, Divider, EmptyState, Field, Icon, IconButton, Pressy, SectionLabel, Sheet, SheetRow, Toggle, Txt, useToast } from '../../ui';
import { t, tr } from '../../i18n';

export default function BusinessHub() {
  const { c, r, setBizAccent } = useTheme();
  const { user } = useAuth();
  const { active, refreshBusinesses, switchSpace } = useSpace();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const biz = active?.business;
  const role = active?.role;
  const manage = canManage(role);

  const [form, setForm] = useState({ name: '', handle: '', category: '', description: '', phone: '', email: '', website: '', address: '' });
  const [greeting, setGreeting] = useState(''); const [away, setAway] = useState(''); const [awayOn, setAwayOn] = useState(false); const [isPublic, setIsPublic] = useState(true); const [showPhone, setShowPhone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quick, setQuick] = useState<QuickReply[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [qrOpen, setQrOpen] = useState(false); const [qrShort, setQrShort] = useState(''); const [qrBody, setQrBody] = useState('');
  const [memberOpen, setMemberOpen] = useState(false); const [mPhone, setMPhone] = useState(''); const [mCountry, setMCountry] = useState<Country>(countries[0]); const [mRole, setMRole] = useState<BusinessRole>('agent'); const [mError, setMError] = useState<string | null>(null);
  const [mSel, setMSel] = useState<TeamMember | null>(null);

  useEffect(() => {
    if (!biz) return;
    setForm({ name: biz.name, handle: biz.handle ?? '', category: biz.category ?? '', description: biz.description ?? '', phone: biz.phone ?? '', email: biz.email ?? '', website: biz.website ?? '', address: biz.address ?? '' });
    setGreeting(biz.greeting ?? ''); setAway(biz.away_message ?? ''); setAwayOn(biz.away_enabled); setIsPublic(biz.is_public); setShowPhone(biz.show_phone);
  }, [biz?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    if (!biz) return;
    try { const [q, t] = await Promise.all([listQuickReplies(biz.id), listTeam(biz.id)]); setQuick(q); setTeam(t); } catch (e) { toast.show(friendly(e), 'error'); }
  }, [biz?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);

  if (!biz) {
    return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><EmptyState icon="storefront" title="Aún no tienes un negocio" body="Crea tu espacio Business para atender clientes, publicar tu catálogo y trabajar en equipo." action="Crear negocio" onAction={() => router.push('/business-create')} /></View>;
  }

  const save = async (patch: Parameters<typeof updateBusiness>[1], msg = 'Cambios guardados') => {
    setSaving(true);
    try { await updateBusiness(biz.id, patch); await refreshBusinesses(); toast.show(msg, 'success'); } catch (e) { toast.show(friendly(e, 'No se pudo guardar.'), 'error'); } finally { setSaving(false); }
  };
  const saveProfile = () => {
    if (!form.name.trim()) return toast.show('El nombre es obligatorio.', 'error');
    if (!/^[a-z0-9-]{3,48}$/.test(form.handle)) return toast.show('Identificador no válido (3–48: minúsculas, números, guiones).', 'error');
    save({ name: form.name.trim(), handle: form.handle, category: form.category || null, description: form.description.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null, website: form.website.trim() || null, address: form.address.trim() || null }, 'Perfil del negocio guardado');
  };
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const publicUrl = `${appUrl()}/b/${biz.handle ?? biz.id}`;
  const cover = publicAvatarUrl(biz.cover_path);
  const assignable = (['admin', 'supervisor', 'agent', 'viewer'] as BusinessRole[]).filter((r) => role === 'owner' || roleRank[r] < roleRank[role ?? 'viewer']);

  const addMember = async () => {
    setMError(null);
    const p = toE164(mCountry, mPhone); if (!p.ok) return setMError(p.reason);
    try { await addTeamMember(biz.id, p.e164, mRole); setMemberOpen(false); setMPhone(''); await reload(); toast.show('Miembro añadido al equipo', 'success'); } catch (e) { setMError(friendly(e, 'No se pudo añadir.')); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 600 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Txt v="h1">Negocio</Txt>
              <IconButton icon="swap-horizontal" label="Cambiar a Personal" onPress={() => switchSpace('personal')} />
            </View>

            <View style={{ borderRadius: r(28), backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
              <View style={{ height: 120, backgroundColor: '#101009' }}>
                {cover ? <Image source={{ uri: cover }} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : (
                  <>
                    <View style={{ position: 'absolute', left: -40, right: -40, bottom: 26, height: 18, backgroundColor: c.highlight, transform: [{ rotate: '-4deg' }] }} />
                    <View style={{ position: 'absolute', left: -40, right: -40, bottom: 10, height: 6, backgroundColor: 'rgba(255,255,255,0.14)', transform: [{ rotate: '-4deg' }] }} />
                  </>
                )}
                {manage && <View style={{ position: 'absolute', right: 10, bottom: 10 }}><CoverPicker path={biz.cover_path} folder={`business/${biz.id}`} light onChange={(p) => save({ cover_path: p }, p ? 'Portada actualizada' : 'Portada eliminada')} /></View>}
              </View>
              <View style={{ alignItems: 'center', gap: 6, padding: 20, paddingTop: 0, marginTop: -52 }}>
                <View style={{ padding: 4, borderRadius: 24, backgroundColor: c.surface }}>
                  {manage ? <PhotoPicker name={biz.name} seed={biz.id} path={biz.logo_path} folder={`business/${biz.id}`} business size={104} label="Cambiar logo" onChange={(p) => save({ logo_path: p }, p ? 'Logo actualizado' : 'Logo eliminado')} /> : <Avatar name={biz.name} seed={biz.id} path={biz.logo_path} size={104} business />}
                </View>
                <Txt v="h2" style={{ marginTop: 6 }}>{biz.name}</Txt>
                <Txt v="small" tone="muted">{[biz.category, biz.handle && `@${biz.handle}`, role && roleLabel[role]].filter(Boolean).join(' · ')}</Txt>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignSelf: 'stretch' }}>
                  <Button title="Ver perfil público" variant="soft" icon="eye" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/b/[id]', params: { id: biz.id } })} />
                  <Button title="Compartir" variant="soft" icon="share-social" size="sm" style={{ flex: 1 }} onPress={async () => toast.show((await shareText(t('Escríbenos por CIFRA: {name}', { name: biz.name }), publicUrl)) === 'copied' ? 'Enlace copiado' : 'Enlace compartido', 'success')} />
                </View>
              </View>
            </View>

            <SectionLabel>Color del negocio</SectionLabel>
            <Card>
              <View style={{ padding: 16, gap: 12 }}>
                <Txt v="small" tone="muted">Tiñe el espacio Business de todo el equipo: barra, botones y perfil público. Así cada negocio se distingue al instante.</Txt>
                <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
                  {bizAccentOptions.map((o) => {
                    const on = (biz.accent ?? 'amber') === o.key;
                    return (
                      <Pressy key={o.key} onPress={() => { if (!manage) return; setBizAccent(o.key); save({ accent: o.key }, t('Color: {name}', { name: tr(o.label) })); }} haptic accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label} scale={0.85} style={{ alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 46, height: 46, borderRadius: r(14), backgroundColor: o.swatch, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 3 : 0, borderColor: c.text, shadowColor: o.swatch, shadowOpacity: on ? 0.55 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}>
                          {on && <Icon name="checkmark" size={22} color="#fff" />}
                        </View>
                        <Txt v="caption" tone={on ? 'text' : 'muted'}>{o.label}</Txt>
                      </Pressy>
                    );
                  })}
                </View>
              </View>
            </Card>

            <SectionLabel>Perfil del negocio</SectionLabel>
            <View style={{ gap: 14 }}>
              <Field label="Nombre" value={form.name} onChangeText={set('name')} editable={manage} maxLength={80} />
              <Field label="Identificador" value={form.handle} onChangeText={(t) => set('handle')(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))} editable={manage} autoCapitalize="none" left={<Txt tone="muted">@</Txt>} />
              <View style={{ gap: 8 }}><Txt v="caption" tone="muted" style={{ marginLeft: 2 }}>Categoría</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{categories.map((x) => <Chip key={x} label={x} active={form.category === x} onPress={() => manage && set('category')(form.category === x ? '' : x)} />)}</View></View>
              <Field label="Descripción" value={form.description} onChangeText={set('description')} editable={manage} multiline maxLength={400} />
              <Field label="Teléfono de contacto" value={form.phone} onChangeText={set('phone')} editable={manage} keyboardType="phone-pad" icon="call" />
              <Field label="Correo" value={form.email} onChangeText={set('email')} editable={manage} keyboardType="email-address" autoCapitalize="none" icon="mail" />
              <Field label="Web" value={form.website} onChangeText={set('website')} editable={manage} autoCapitalize="none" icon="globe" placeholder="https://" />
              <Field label="Dirección" value={form.address} onChangeText={set('address')} editable={manage} icon="location" />
              <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}><View style={{ flex: 1 }}><Txt v="bodyStrong">Visible para clientes</Txt><Txt v="caption" tone="muted">Aparece en búsquedas y puede recibir mensajes.</Txt></View><Toggle value={isPublic} label="Negocio visible" onChange={(v) => { if (!manage) return; setIsPublic(v); save({ is_public: v }, v ? 'Negocio visible' : 'Negocio oculto'); }} /></View></Card>
              <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}><Icon name={showPhone ? 'call' : 'eye-off'} size={20} tone="accent" /><View style={{ flex: 1 }}><Txt v="bodyStrong">Mostrar el teléfono públicamente</Txt><Txt v="caption" tone="muted">Apagado: los clientes solo te escriben por CIFRA y ven tu @identificador, nunca tu número.</Txt></View><Toggle value={showPhone} label="Mostrar el teléfono públicamente" onChange={(v) => { if (!manage) return; setShowPhone(v); save({ show_phone: v }, v ? 'Teléfono visible' : 'Teléfono oculto'); }} /></View></Card>
              {manage && <Button title="Guardar perfil" loading={saving} onPress={saveProfile} />}
            </View>

            <SectionLabel>Automatizaciones</SectionLabel>
            <Card>
              <View style={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="hand-right" size={19} tone="accent" /><Txt v="bodyStrong">Saludo de bienvenida</Txt></View>
                <Txt v="small" tone="muted">Se envía solo cuando un cliente te escribe por primera vez.</Txt>
                <Field value={greeting} onChangeText={setGreeting} editable={manage} multiline placeholder="¡Hola! Gracias por escribirnos. ¿En qué podemos ayudarte?" maxLength={500} />
                {manage && <Button title="Guardar saludo" variant="soft" size="sm" full={false} onPress={() => save({ greeting: greeting.trim() || null }, 'Saludo guardado')} />}
              </View>
              <Divider />
              <View style={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="moon" size={19} tone="accent" /><Txt v="bodyStrong" style={{ flex: 1 }}>Mensaje de ausencia</Txt><Toggle value={awayOn} label="Mensaje de ausencia" onChange={(v) => { if (!manage) return; setAwayOn(v); save({ away_enabled: v }, v ? 'Ausencia activada' : 'Ausencia desactivada'); }} /></View>
                <Txt v="small" tone="muted">Responde automáticamente (máximo una vez cada 12 horas por cliente).</Txt>
                <Field value={away} onChangeText={setAway} editable={manage} multiline placeholder="Ahora mismo no estamos disponibles. Te respondemos en cuanto volvamos." maxLength={500} />
                {manage && <Button title="Guardar mensaje" variant="soft" size="sm" full={false} onPress={() => save({ away_message: away.trim() || null }, 'Mensaje guardado')} />}
              </View>
            </Card>

            <SectionLabel>Respuestas rápidas</SectionLabel>
            <Card>
              {quick.length === 0 && <Txt tone="muted" style={{ padding: 16 }}>Crea atajos para contestar en un toque a las preguntas más frecuentes.</Txt>}
              {quick.map((q, i) => (
                <View key={q.id}>{i > 0 && <Divider />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                    <Icon name="flash" size={18} tone="accent" /><View style={{ flex: 1 }}><Txt v="smallStrong">/{q.shortcut}</Txt><Txt v="small" tone="muted" numberOfLines={2}>{q.body}</Txt></View>
                    {manage && <IconButton icon="trash" label="Eliminar respuesta rápida" tone="danger" size={36} onPress={async () => { try { await deleteQuickReply(q.id); setQuick((x) => x.filter((y) => y.id !== q.id)); } catch (e) { toast.show(friendly(e), 'error'); } }} />}
                  </View></View>
              ))}
              {manage && <><Divider /><SheetRow icon="add-circle" label="Nueva respuesta rápida" tone="accent" onPress={() => setQrOpen(true)} /></>}
            </Card>

            <SectionLabel>Equipo</SectionLabel>
            <Card>
              {team.map((t, i) => (
                <View key={t.user_id}>{i > 0 && <Divider inset={70} />}
                  <Pressy onPress={() => manage && t.role !== 'owner' && setMSel(t)} scale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
                    <Avatar name={t.display_name} seed={t.user_id} path={t.avatar_path} size={42} />
                    <View style={{ flex: 1 }}><Txt v="bodyStrong">{t.display_name}{t.user_id === user?.id ? ' (tú)' : ''}</Txt><Txt v="caption" tone="muted">{formatPhone(t.phone)}</Txt></View>
                    <View style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: c.accentSoft, justifyContent: 'center' }}><Txt v="caption" style={{ color: c.accentSoftText }}>{roleLabel[t.role]}</Txt></View>
                  </Pressy></View>
              ))}
              {manage && <><Divider /><SheetRow icon="person-add" label="Añadir miembro por número" tone="accent" onPress={() => setMemberOpen(true)} /></>}
            </Card>
            <Txt v="caption" tone="faint" style={{ marginTop: 8, marginLeft: 4 }}>Cada persona entra con su propia cuenta; el acceso al negocio se puede revocar en cualquier momento.</Txt>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={qrOpen} onClose={() => setQrOpen(false)} title="Nueva respuesta rápida">
        <View style={{ gap: 12 }}>
          <Field label="Atajo" value={qrShort} onChangeText={(t) => setQrShort(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))} autoCapitalize="none" left={<Txt tone="muted">/</Txt>} placeholder="horario" maxLength={32} />
          <Field label="Mensaje" value={qrBody} onChangeText={setQrBody} multiline maxLength={800} placeholder="Abrimos de lunes a sábado de 9:00 a 20:00." />
          <Button title="Guardar" disabled={!qrShort || !qrBody.trim()} onPress={async () => { try { await addQuickReply(biz.id, qrShort, qrBody.trim()); setQrOpen(false); setQrShort(''); setQrBody(''); await reload(); } catch (e) { toast.show(friendly(e), 'error'); } }} />
        </View>
      </Sheet>

      <Sheet visible={memberOpen} onClose={() => setMemberOpen(false)} title="Añadir al equipo">
        <View style={{ gap: 12 }}>
          <Txt v="small" tone="muted">La persona debe tener ya una cuenta en CIFRA con ese número.</Txt>
          <PhoneField value={mPhone} onChange={setMPhone} country={mCountry} onCountry={setMCountry} error={mError} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{assignable.map((r) => <Chip key={r} label={roleLabel[r]} active={mRole === r} onPress={() => setMRole(r)} />)}</View>
          <Button title="Añadir al equipo" onPress={addMember} disabled={!mPhone.trim()} />
        </View>
      </Sheet>

      <Sheet visible={!!mSel} onClose={() => setMSel(null)} title={mSel?.display_name}>
        {assignable.map((r) => <SheetRow key={r} icon="ribbon" label={t('Cambiar a {role}', { role: tr(roleLabel[r]) })} right={mSel?.role === r ? <Icon name="checkmark-circle" tone="accent" /> : undefined} onPress={async () => { const m = mSel!; setMSel(null); try { await setTeamRole(biz.id, m.user_id, r); await reload(); } catch (e) { toast.show(friendly(e), 'error'); } }} />)}
        <SheetRow icon="person-remove" label="Quitar del equipo" tone="danger" onPress={async () => { const m = mSel!; setMSel(null); try { await removeTeamMember(biz.id, m.user_id); await reload(); toast.show('Miembro eliminado', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } }} />
      </Sheet>
    </View>
  );
}
