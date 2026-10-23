import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PublicBusiness, StatusRow, deleteStatus, getPublicBusiness, listBusinessPosts, searchBusinesses, startBusinessChat } from '../../../lib/api';
import { friendly } from '../../../lib/errors';
import { money, relative } from '../../../lib/format';
import { publicAvatarUrl, signedMediaUrl } from '../../../lib/media';
import { StatusViewer } from '../../../features/status/StatusViewer';
import { statusBackgrounds } from '../../../theme/tokens';
import { appUrl, shareText } from '../../../lib/share';
import { useSpace } from '../../../state/SpaceProvider';
import { useTheme } from '../../../theme/ThemeProvider';
import { ProfileHero } from '../../../components/ProfileHero';
import { SlotPicker } from '../../../components/SlotPicker';
import { requestAppointment } from '../../../lib/biz';
import { Button, Card, ChatSkeleton, Divider, EmptyState, Field, Icon, IconButton, Pressy, Sheet, Txt, useToast } from '../../../ui';
import { loc, t } from '../../../i18n';

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** Small tile of a business post for the "Novedades" strip on the public profile. */
function PostThumb({ s, onPress }: { s: StatusRow; onPress: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let live = true; if (s.kind === 'image' && s.media_path) signedMediaUrl(s.media_path).then((u) => live && setUrl(u)); return () => { live = false; }; }, [s.media_path, s.kind]);
  const bg = statusBackgrounds[s.bg % statusBackgrounds.length][1];
  return (
    <Pressy onPress={onPress} accessibilityRole="button" accessibilityLabel={s.body ?? (s.kind === 'video' ? 'Vídeo' : 'Foto')} scale={0.96} style={{ width: 104, height: 140, borderRadius: 16, overflow: 'hidden', backgroundColor: s.kind === 'text' ? bg : '#0A0A08', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      {s.kind === 'image' && url ? <Image source={{ uri: url }} resizeMode="cover" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' } as object} /> : null}
      {s.kind === 'text' && <Txt v="caption" numberOfLines={5} style={{ color: '#fff', textAlign: 'center' }}>{s.body}</Txt>}
      {s.kind === 'video' && <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={18} color="#fff" /></View>}
      <View style={{ position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' }}><Txt style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>{relative(s.created_at)}</Txt></View>
    </Pressy>
  );
}

export default function BusinessProfile() {
  const { id, chat } = useLocalSearchParams<{ id: string; chat?: string }>();
  const { c } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { businesses } = useSpace();
  const [biz, setBiz] = useState<PublicBusiness | null | undefined>(undefined);
  const [posts, setPosts] = useState<StatusRow[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
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
        if (bid) listBusinessPosts([bid]).then((p) => live && setPosts(p)).catch(() => {});
      } catch (e) { if (live) { setBiz(null); toast.show(friendly(e), 'error'); } }
    })();
    return () => { live = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const own = !!biz && businesses.some((b) => b.business.id === biz.id);
  const message = async () => {
    if (!biz) return; setBusy(true);
    try { const cid = await startBusinessChat(biz.id); router.replace({ pathname: '/chat/[id]', params: { id: cid } }); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };
  // "Escribir" from a post in the viewer lands here with ?chat=1: go straight to the conversation.
  useEffect(() => { if (chat === '1' && biz && !own) message(); }, [chat, biz?.id, own]); // eslint-disable-line react-hooks/exhaustive-deps
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
            kind="business" name={biz.name} seed={biz.id} avatarPath={biz.logo_path} coverPath={biz.cover_path} accent={biz.accent} handle={biz.handle} tagline={biz.category} bio={biz.description}
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

              {posts.length > 0 && (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt v="h2" style={{ flex: 1 }}>Novedades</Txt><Txt v="caption" tone="muted">{posts.length === 1 ? '1 publicación' : t('{n} publicaciones', { n: posts.length })}</Txt></View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {posts.map((s, i) => <PostThumb key={s.id} s={s} onPress={() => setViewing(i)} />)}
                  </ScrollView>
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
      {biz && <StatusViewer visible={viewing !== null && posts.length > 0} items={viewing === null ? [] : [...posts.slice(viewing), ...posts.slice(0, viewing)]} name={biz.name} avatarPath={biz.logo_path} seed={biz.id} mine={own} business={{ id: biz.id, handle: biz.handle }} onClose={() => setViewing(null)}
        onDelete={own ? async (s) => { try { await deleteStatus(s.id); setPosts((p) => p.filter((x) => x.id !== s.id)); } catch (e) { toast.show(friendly(e), 'error'); } } : undefined} />}
      <Sheet visible={reqOpen} onClose={() => setReqOpen(false)} title="Solicitar una cita">
        <Txt v="small" tone="muted" style={{ marginBottom: 10 }}>Elige el día y la hora que prefieras. {biz?.name} la confirmará por el chat.</Txt>
        <SlotPicker value={slot} onChange={setSlot} />
        <Field label="Nota (opcional)" value={note} onChangeText={setNote} placeholder="¿Qué necesitas?" maxLength={200} />
        <Button title={slot ? t('Pedir cita · {when}', { when: slot.toLocaleString(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : 'Elige día y hora'} disabled={!slot} loading={busy} style={{ marginTop: 12 }} onPress={sendRequest} />
      </Sheet>
    </View>
  );
}
