import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatalogItem, deleteCatalogItem, listCatalog, saveCatalogItem } from '../../lib/api';
import { canManage, currencies } from '../../lib/business';
import { friendly } from '../../lib/errors';
import { money } from '../../lib/format';
import { Picked, pickPhoto, publicAvatarUrl, uploadMedia } from '../../lib/media';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, ChatSkeleton, Chip, EmptyState, Field, Icon, IconButton, Pressy, Sheet, Toggle, Txt, useToast } from '../../ui';

type Draft = { id?: string; name: string; description: string; price: string; currency: string; is_published: boolean; image_path: string | null; localUri?: string; file?: Picked };
const blank: Draft = { name: '', description: '', price: '', currency: 'EUR', is_published: true, image_path: null };

export default function Catalog() {
  const { c } = useTheme();
  const { active } = useSpace();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 4 : width >= 700 ? 3 : 2;
  const biz = active?.business;
  const manage = canManage(active?.role);
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { if (!biz) return; try { setItems(await listCatalog(biz.id)); } catch (e) { toast.show(friendly(e), 'error'); setItems((x) => x ?? []); } }, [biz?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  if (!biz) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><EmptyState icon="pricetags" title="Primero crea tu negocio" body="El catálogo forma parte de tu espacio Business." action="Crear negocio" onAction={() => router.push('/business-create')} /></View>;

  const edit = (i: CatalogItem) => setDraft({ id: i.id, name: i.name, description: i.description ?? '', price: i.price_minor != null ? String(i.price_minor / 100) : '', currency: i.currency ?? 'EUR', is_published: i.is_published, image_path: i.image_path });
  const choosePhoto = async () => { try { const f = await pickPhoto({ max: 1200 }); if (f) setDraft((d) => d && { ...d, file: f, localUri: f.uri }); } catch (e) { toast.show(friendly(e), 'error'); } };

  const save = async () => {
    if (!draft || !draft.name.trim()) return toast.show('Ponle un nombre al producto.', 'error');
    const price = draft.price.trim() ? Math.round(parseFloat(draft.price.replace(',', '.')) * 100) : null;
    if (price != null && (Number.isNaN(price) || price < 0)) return toast.show('El precio no es válido.', 'error');
    setSaving(true);
    try {
      let image_path = draft.image_path;
      if (draft.file) image_path = await uploadMedia('avatars', `business/${biz.id}`, draft.file);
      await saveCatalogItem({ ...(draft.id ? { id: draft.id } : {}), business_id: biz.id, name: draft.name.trim(), description: draft.description.trim() || null, price_minor: price, currency: price != null ? draft.currency : null, is_published: draft.is_published, image_path });
      setDraft(null); await load(); toast.show('Producto guardado', 'success');
    } catch (e) { toast.show(friendly(e, 'No se pudo guardar el producto.'), 'error'); } finally { setSaving(false); }
  };

  const gap = 12; const pad = 16; const cardW = (Math.min(width, 1200) - pad * 2 - gap * (cols - 1) - (width >= 900 ? 84 : 0)) / cols;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: pad, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.accent} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <View><Txt v="h1">Catálogo</Txt><Txt tone="muted">Lo que verán tus clientes en tu perfil.</Txt></View>
          {manage && <IconButton icon="add" label="Añadir producto" filled onPress={() => setDraft({ ...blank })} />}
        </View>
        {items === null ? <ChatSkeleton rows={4} /> : items.length === 0 ? <EmptyState icon="pricetags" title="Tu catálogo está vacío" body="Añade productos o servicios con foto y precio para mostrarlos a quien te escribe." action={manage ? 'Añadir el primero' : undefined} onAction={manage ? () => setDraft({ ...blank }) : undefined} /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, marginTop: 14 }}>
            {items.map((i) => {
              const uri = publicAvatarUrl(i.image_path);
              return (
                <Pressy key={i.id} onPress={() => manage && edit(i)} scale={0.98} accessibilityRole="button" accessibilityLabel={i.name} style={{ width: cardW, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden', opacity: i.is_published ? 1 : 0.65 }}>
                  <View style={{ width: '100%', aspectRatio: 1, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' }}>
                    {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Icon name="image" size={34} tone="faint" />}
                    {!i.is_published && <View style={{ position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: c.text, justifyContent: 'center' }}><Txt v="caption" style={{ color: c.bg }}>Borrador</Txt></View>}
                  </View>
                  <View style={{ padding: 12, gap: 2 }}><Txt v="bodyStrong" numberOfLines={1}>{i.name}</Txt>{i.price_minor != null && <Txt v="smallStrong" tone="accent">{money(i.price_minor, i.currency)}</Txt>}{i.description ? <Txt v="caption" tone="muted" numberOfLines={2}>{i.description}</Txt> : null}</View>
                </Pressy>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Sheet visible={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Editar producto' : 'Nuevo producto'}>
        {draft && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ gap: 14 }}>
              <Pressy onPress={choosePhoto} accessibilityRole="button" accessibilityLabel="Elegir foto del producto" scale={0.98} style={{ height: 180, borderRadius: 20, backgroundColor: c.sunken, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {draft.localUri || draft.image_path ? <Image source={{ uri: draft.localUri ?? publicAvatarUrl(draft.image_path)! }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <><Icon name="camera" size={30} tone="muted" /><Txt v="smallStrong" tone="muted">Añadir foto</Txt></>}
              </Pressy>
              {(draft.localUri || draft.image_path) && <Button title="Quitar foto" variant="ghost" size="sm" full={false} onPress={() => setDraft({ ...draft, localUri: undefined, file: undefined, image_path: null })} />}
              <Field label="Nombre" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} maxLength={120} placeholder="Flat white" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Precio" value={draft.price} onChangeText={(t) => setDraft({ ...draft, price: t.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" placeholder="3,50" /></View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{currencies.map((cur) => <Chip key={cur} label={cur} active={draft.currency === cur} onPress={() => setDraft({ ...draft, currency: cur })} />)}</View>
              <Field label="Descripción" value={draft.description} onChangeText={(t) => setDraft({ ...draft, description: t })} multiline maxLength={600} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><Txt v="bodyStrong">Publicado</Txt><Txt v="caption" tone="muted">Si está apagado queda como borrador.</Txt></View><Toggle value={draft.is_published} onChange={(v) => setDraft({ ...draft, is_published: v })} label="Publicado" /></View>
              <Button title="Guardar" size="lg" loading={saving} onPress={save} />
              {draft.id && <Button title="Eliminar producto" variant="danger" onPress={async () => { try { await deleteCatalogItem(draft.id!); setDraft(null); await load(); } catch (e) { toast.show(friendly(e), 'error'); } }} />}
            </View>
          </KeyboardAvoidingView>
        )}
      </Sheet>
    </View>
  );
}
