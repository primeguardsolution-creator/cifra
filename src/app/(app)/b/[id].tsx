import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PublicBusiness, getPublicBusiness, searchBusinesses, startBusinessChat } from '../../../lib/api';
import { friendly } from '../../../lib/errors';
import { money } from '../../../lib/format';
import { publicAvatarUrl } from '../../../lib/media';
import { appUrl, shareText } from '../../../lib/share';
import { useSpace } from '../../../state/SpaceProvider';
import { useTheme } from '../../../theme/ThemeProvider';
import { ProfileHero } from '../../../components/ProfileHero';
import { SlotPicker } from '../../../components/SlotPicker';
import { requestAppointment } from '../../../lib/biz';
import { Button, Card, ChatSkeleton, Divider, EmptyState, Field, Icon, IconButton, Sheet, Txt, useToast } from '../../../ui';
import { loc, t } from '../../../i18n';

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export default function BusinessProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { businesses } = useSpace();
  const [biz, setBiz] = useState<PublicBusiness | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [slot, setSlot] = useState<Date | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        let bid = id;
        if (!isUuid(id)) { const hit = (await searchBusinesses(id)).find((b) => b.handle === id.toLowerCase()); bid = hit?.id ?? ''; }
        const data = bid ? await getPublicBusiness(bid) : null;
        if (live) setBiz(data);
      } catch (e) { if (live) { setBiz(null); toast.show(friendly(e), 'error'); } }
    })();
    return () => { live = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const own = !!biz && businesses.some((b) => b.business.id === biz.id);
  const message = async () => {
    if (!biz) return; setBusy(true);
    try { const cid = await startBusinessChat(biz.id); router.replace({ pathname: '/chat/[id]', params: { id: cid } }); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };
  const sendRequest = async () => {
    if (!biz || !slot) return; setBusy(true);
    try { await requestAppointment(biz.id, slot, note); setReqOpen(false); toast.show('Cita solicitada. Te avisarán por el chat.', 'success'); const cid = await startBusinessChat(biz.id); router.replace({ pathname: '/chat/[id]', params: { id: cid } }); }
    catch (e) { toast.show(friendly(e, 'No se pudo solicitar la cita.'), 'error'); } finally { setBusy(false); }
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/chats'));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 50 }}>
        {biz ? (
          <ProfileHero
            kind="business" name={biz.name} seed={biz.id} avatarPath={biz.logo_path} handle={biz.handle} tagline={biz.category} bio={biz.description}
            badges={[{ icon: 'storefront', label: 'Business', tone: 'warm' }, ...(biz.catalog.length ? [{ icon: 'pricetags' as const, label: t('{n} en catálogo', { n: biz.catalog.length }), tone: 'muted' as const }] : [])]}
            topLeft={<IconButton icon="chevron-back" label="Volver" onPress={back} filled />}
            topRight={<IconButton icon="share-social" label="Compartir" filled onPress={async () => toast.show((await shareText(t('Escribe a {name} por CIFRA', { name: biz.name }), `${appUrl()}/b/${biz.handle ?? biz.id}`)) === 'copied' ? 'Enlace copiado' : 'Enlace compartido', 'success')} />}
          />
        ) : <View style={{ height: 120 + insets.top }} />}
        <View style={{ width: '100%', maxWidth: 640, paddingHorizontal: 16, marginTop: 16, gap: 16 }}>
          {biz === undefined ? <ChatSkeleton rows={3} /> : biz === null ? <EmptyState icon="storefront" title="Negocio no disponible" body="Puede que haya cambiado su identificador o ya no sea público." action="Volver" onAction={back} /> : (
            <>
              {own ? <Button title="Es tu negocio · Editar" variant="soft" icon="create" onPress={() => router.push('/business')} /> : (
                <View style={{ gap: 10 }}>
                  <Button title="Enviar mensaje" size="lg" icon="chatbubble" loading={busy} onPress={message} />
                  <Button title="Solicitar una cita" variant="secondary" icon="calendar" onPress={() => { setSlot(null); setReqOpen(true); }} />
                </View>
              )}

              {(biz.phone || biz.email || biz.website || biz.address) && (
                <Card>
                  {[
                    biz.phone && { icon: 'call' as const, text: biz.phone, href: `tel:${biz.phone}` }, biz.email && { icon: 'mail' as const, text: biz.email, href: `mailto:${biz.email}` },
                    biz.website && { icon: 'globe' as const, text: biz.website, href: /^https?:/.test(biz.website) ? biz.website : `https://${biz.website}` }, biz.address && { icon: 'location' as const, text: biz.address, href: `https://maps.google.com/?q=${encodeURIComponent(biz.address)}` },
                  ].filter(Boolean).map((r, i) => {
                    const row = r as { icon: 'call'; text: string; href: string };
                    return <View key={row.text}>{i > 0 && <Divider inset={50} />}<View style={{ flexDirection: 'row', gap: 14, padding: 14, alignItems: 'center' }}><Icon name={row.icon} size={18} tone="accent" /><Txt v="small" style={{ flex: 1 }} onPress={() => Linking.openURL(row.href)}>{row.text}</Txt></View></View>;
                  })}
                </Card>
              )}
              {!biz.phone && !own && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="eye-off" size={14} tone="faint" /><Txt v="caption" tone="faint">Este negocio solo atiende por CIFRA: no comparte su teléfono.</Txt></View>}

              {biz.catalog.length > 0 && (
                <View style={{ gap: 12 }}>
                  <Txt v="h2">Catálogo</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {biz.catalog.map((i) => {
                      const uri = publicAvatarUrl(i.image_path);
                      return (
                        <View key={i.id} style={{ width: '47.5%', borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
                          <View style={{ aspectRatio: 1, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' }}>{uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Icon name="image" size={30} tone="faint" />}</View>
                          <View style={{ padding: 12, gap: 2 }}><Txt v="bodyStrong" numberOfLines={1}>{i.name}</Txt>{i.price_minor != null && <Txt v="smallStrong" tone="accent">{money(i.price_minor, i.currency)}</Txt>}{i.description ? <Txt v="caption" tone="muted" numberOfLines={3}>{i.description}</Txt> : null}</View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      <Sheet visible={reqOpen} onClose={() => setReqOpen(false)} title="Solicitar una cita">
        <Txt v="small" tone="muted" style={{ marginBottom: 10 }}>Elige el día y la hora que prefieras. {biz?.name} la confirmará por el chat.</Txt>
        <SlotPicker value={slot} onChange={setSlot} />
        <Field label="Nota (opcional)" value={note} onChangeText={setNote} placeholder="¿Qué necesitas?" maxLength={200} />
        <Button title={slot ? t('Pedir cita · {when}', { when: slot.toLocaleString(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : 'Elige día y hora'} disabled={!slot} loading={busy} style={{ marginTop: 12 }} onPress={sendRequest} />
      </Sheet>
    </View>
  );
}
