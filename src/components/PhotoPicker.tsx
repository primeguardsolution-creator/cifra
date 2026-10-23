import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, View } from 'react-native';
import { CoverImage } from './CoverImage';
import { friendly } from '../lib/errors';
import { Picked, coverFile, coverFocus, pickPhoto, uploadMedia, withCoverFocus } from '../lib/media';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar, Icon, Pressy, Sheet, SheetRow, Txt, useToast } from '../ui';

/** "Cambiar portada" key for the profile hero: wide (not square) picture, upload, replace, choose which part shows, and remove. */
export function CoverPicker({ path, folder, onChange, light }: { path?: string | null; folder: string; onChange: (path: string | null) => Promise<void> | void; light?: boolean }) {
  const { c } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [cur, setCur] = useState<string | null>(path ?? null);
  const [y, setY] = useState(50);
  const start = useRef(50);
  const boxH = useRef(160);
  useEffect(() => { setCur(path ?? null); }, [path]);
  const removeOld = (old?: string | null) => { const f = coverFile(old); if (f && !/^https?:/.test(f)) supabase.storage.from('avatars').remove([f]).catch(() => {}); };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = yRef.current; },
    // dragging the photo down reveals its upper part, like moving the picture inside its frame
    onPanResponderMove: (_, g) => { const v = Math.max(0, Math.min(100, start.current - (g.dy / boxH.current) * 100)); yRef.current = v; setY(v); },
  })).current;
  const yRef = useRef(50);
  yRef.current = y;
  const choose = async () => {
    setOpen(false); setBusy(true);
    try {
      const file = await pickPhoto({ max: 1600 });
      if (!file) return;
      const next = await uploadMedia('avatars', folder, file);
      await onChange(next);
      removeOld(path);
      setCur(next); setY(50); setAdjust(true); // straight to "choose which part shows"
    } catch (e) { toast.show(friendly(e, 'No se pudo cambiar la portada.'), 'error'); } finally { setBusy(false); }
  };
  const openAdjust = () => { setOpen(false); setY(coverFocus(cur)); setAdjust(true); };
  const saveAdjust = async () => {
    if (!cur) return;
    setBusy(true);
    try { const next = withCoverFocus(cur, y); await onChange(next); setCur(next); setAdjust(false); toast.show('Portada actualizada', 'success'); }
    catch (e) { toast.show(friendly(e, 'No se pudo guardar.'), 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    setOpen(false); setBusy(true);
    try { await onChange(null); removeOld(path); setCur(null); toast.show('Portada eliminada', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };
  const fg = light ? '#fff' : c.text;
  return (
    <>
      <Pressy onPress={() => setOpen(true)} disabled={busy} accessibilityRole="button" accessibilityLabel="Cambiar portada" scale={0.94}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: light ? 'rgba(0,0,0,0.45)' : c.surface, borderWidth: light ? 0 : 1, borderColor: c.border }}>
        {busy ? <ActivityIndicator color={fg} size="small" /> : <Icon name="image" size={15} color={fg} />}
        <Txt v="caption" style={{ color: fg }}>Portada</Txt>
      </Pressy>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Foto de portada">
        <SheetRow icon="images" label="Elegir de la galería" sub="Se recorta al ancho de la pantalla" onPress={choose} />
        {cur ? <SheetRow icon="move" label="Mover la foto" sub="Elige qué parte de la foto se ve" onPress={openAdjust} /> : null}
        {cur ? <SheetRow icon="trash" label="Quitar portada" tone="danger" onPress={remove} /> : null}
      </Sheet>
      <Sheet visible={adjust} onClose={() => setAdjust(false)} title="Mover la foto" scroll={false}>
        <View style={{ padding: 16, gap: 14 }}>
          <View onLayout={(e) => { boxH.current = e.nativeEvent.layout.height || 160; }} {...pan.panHandlers} accessibilityLabel="Arrastra la foto arriba o abajo"
            style={{ height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: c.sunken, borderWidth: 1, borderColor: c.border, cursor: 'grab' } as object}>
            <CoverImage path={cur ? withCoverFocus(cur, y) : null} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 8, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.5)' }}><Icon name="swap-vertical" size={14} color="#fff" /><Txt v="caption" style={{ color: '#fff' }}>Arrastra para encuadrar</Txt></View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([['Arriba', 0], ['Centro', 50], ['Abajo', 100]] as const).map(([label, v]) => (
              <Pressy key={label} onPress={() => setY(v)} accessibilityRole="button" scale={0.96} style={{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Math.round(y) === v ? c.accent : c.border, backgroundColor: Math.round(y) === v ? c.accentSoft : c.surface }}>
                <Txt v="smallStrong" tone={Math.round(y) === v ? 'accent' : 'text'}>{label}</Txt>
              </Pressy>
            ))}
          </View>
          <Pressy onPress={saveAdjust} disabled={busy} accessibilityRole="button" scale={0.98} style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Txt v="bodyStrong" style={{ color: '#fff' }}>Guardar encuadre</Txt>}
          </Pressy>
        </View>
      </Sheet>
    </>
  );
}

type Props = {
  name?: string | null; seed?: string; path?: string | null; size?: number; business?: boolean;
  /** Storage folder inside the public `avatars` bucket (`<userId>` or `business/<businessId>`). */
  folder: string;
  onChange: (path: string | null) => Promise<void> | void;
  label?: string;
};

/** Tap-to-change photo with upload, replace and remove. Used for profiles, business logos and product photos. */
export function PhotoPicker({ name, seed, path, size = 112, business, folder, onChange, label = 'Cambiar foto' }: Props) {
  const { c } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const removeOld = (old?: string | null) => { if (old && !/^https?:/.test(old)) supabase.storage.from('avatars').remove([old]).catch(() => {}); };

  const choose = async () => {
    setOpen(false); setBusy(true);
    try {
      const file: Picked | null = await pickPhoto({ square: true });
      if (!file) return;
      const next = await uploadMedia('avatars', folder, file);
      await onChange(next);
      removeOld(path);
      toast.show('Foto actualizada', 'success');
    } catch (e) { toast.show(friendly(e, 'No se pudo cambiar la foto.'), 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    setOpen(false); setBusy(true);
    try { await onChange(null); removeOld(path); toast.show('Foto eliminada', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <Pressy onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label} scale={0.97} style={{ width: size, height: size }}>
        <Avatar name={name} seed={seed} path={path} size={size} business={business} />
        {busy && <View style={{ position: 'absolute', inset: 0, borderRadius: business ? size * 0.3 : size / 2, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' } as object}><ActivityIndicator color="#fff" /></View>}
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: size * 0.34, height: size * 0.34, borderRadius: size * 0.17, backgroundColor: c.accent, borderWidth: 3, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size={size * 0.16} color={c.accentText} />
        </View>
      </Pressy>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Foto">
        <SheetRow icon="images" label="Elegir de la galería" onPress={choose} />
        {path ? <SheetRow icon="trash" label="Quitar foto" tone="danger" onPress={remove} /> : null}
      </Sheet>
    </>
  );
}
