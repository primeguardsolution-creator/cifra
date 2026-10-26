import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { deleteMyAccount, purgeMyFiles } from '../../lib/account';
import { friendly } from '../../lib/errors';
import { useAuth } from '../../state/AuthProvider';
import { Button, Field, Icon, Sheet, Txt, useToast } from '../../ui';
import { t, tr } from '../../i18n';


/** Permanent deletion. Asks for the password again and for the word ELIMINAR, deletes the uploaded files, then the account. */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, signIn, signOut } = useAuth();
  const toast = useToast();
  const WORD = tr('ELIMINAR');
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setPassword(''); setWord(''); } }, [visible]);

  const run = async () => {
    if (!user?.phone) return;
    setBusy(true);
    try {
      await signIn(user.phone, password); // proves it is really the owner
      await purgeMyFiles(user.id);
      await deleteMyAccount();
      await signOut().catch(() => {});
      toast.show('Tu cuenta se ha eliminado', 'success');
      router.replace('/');
    } catch (e) {
      const m = String((e as Error)?.message ?? '');
      toast.show(/business_has_team/.test(m) ? 'Eres propietario de un negocio con equipo. Quita al equipo o traspasa el negocio antes de eliminar tu cuenta.' : friendly(e), 'error');
    } finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={() => !busy && onClose()} title="Eliminar mi cuenta">
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="warning" size={22} tone="danger" />
          <Txt v="small" style={{ flex: 1 }}>Esto no se puede deshacer. Se borran tu perfil, tus mensajes, tus estados, tus contactos y tus archivos, y los negocios que tengas tú solo. Las conversaciones con otras personas siguen para ellas, sin tus mensajes.</Txt>
        </View>
        <Field label="Tu contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
        <Field label={t('Escribe {word} para confirmar', { word: WORD })} value={word} onChangeText={setWord} autoCapitalize="characters" />
        <Button title="Eliminar mi cuenta para siempre" icon="trash" variant="danger" loading={busy} disabled={!password || word.trim().toUpperCase() !== WORD} onPress={run} />
        <Button title="Cancelar" variant="ghost" disabled={busy} onPress={onClose} />
      </View>
    </Sheet>
  );
}
