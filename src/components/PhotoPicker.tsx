import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { friendly } from '../lib/errors';
import { Picked, pickPhoto, uploadMedia } from '../lib/media';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar, Icon, Pressy, Sheet, SheetRow, useToast } from '../ui';

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
