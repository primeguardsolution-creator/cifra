import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Chat, requestIncognitoDestroy, startIncognitoChat } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { incognitoLeft } from '../../components/ChatRow';
import { useChats } from '../../state/ChatsProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { font } from '../../theme/tokens';
import { Button, Field, Icon, Pressy, Sheet, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

/** Re-renders every 30 s so the countdown stays honest. */
function useTick(ms = 30_000) {
  const [, setN] = useState(0);
  useEffect(() => { const id = setInterval(() => setN((n) => n + 1), ms); return () => clearInterval(id); }, [ms]);
}

/**
 * Strip under the header of an incognito room: the self-destruct countdown and the mutual "destroy now" handshake
 * (one side asks, the other accepts; the room is wiped the moment both agree).
 */
export function IncognitoBar({ chat, peerName, onChanged }: { chat: Chat; peerName: string; onChanged: (c: Partial<Chat>) => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const { refresh } = useChats();
  const [busy, setBusy] = useState(false);
  useTick();
  const left = incognitoLeft(chat);
  const act = async (cancel: boolean) => {
    setBusy(true);
    try {
      const gone = await requestIncognitoDestroy(chat.id, cancel);
      if (gone) { toast.show('Chat destruido. No queda rastro.', 'success'); refresh(); router.replace('/chats'); return; }
      onChanged({ destroy_mine: !cancel });
      toast.show(cancel ? 'Petición retirada' : t('Pedido. Se destruirá en cuanto {name} acepte.', { name: peerName }), 'info');
    } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <View style={{ backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="glasses" size={16} tone="muted" />
        <Txt v="caption" tone="muted" style={{ flex: 1 }}>{left ? t('Incógnito · se autodestruye en {left} sin actividad', { left }) : 'Incógnito · se autodestruye tras 3 h sin actividad'}</Txt>
        {!chat.destroy_mine && !chat.destroy_peer && (
          <Pressy onPress={() => act(false)} disabled={busy} accessibilityRole="button" accessibilityLabel="Destruir el chat ahora" scale={0.94} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1, borderColor: c.borderStrong }}>
            <Icon name="flame" size={13} tone="text" /><Txt v="caption">Destruir ahora</Txt>
          </Pressy>
        )}
      </View>
      {chat.destroy_peer && !chat.destroy_mine && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1, borderColor: c.text, borderRadius: 4 }}>
          <Txt v="small" style={{ flex: 1 }}>{t('{name} quiere destruir este chat ahora.', { name: peerName })}</Txt>
          <Pressy onPress={() => act(false)} disabled={busy} accessibilityRole="button" accessibilityLabel="Aceptar y destruir" scale={0.94} style={{ height: 32, paddingHorizontal: 12, borderRadius: 4, backgroundColor: c.text, justifyContent: 'center' }}><Txt v="caption" style={{ color: c.bg }}>Aceptar y destruir</Txt></Pressy>
        </View>
      )}
      {chat.destroy_mine && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt v="caption" tone="muted" style={{ flex: 1 }}>{chat.destroy_peer ? 'Destruyendo…' : t('Has pedido destruirlo · esperando a {name}', { name: peerName })}</Txt>
          <Pressy onPress={() => act(true)} disabled={busy} accessibilityRole="button" accessibilityLabel="Retirar la petición" scale={0.94}><Txt v="caption" style={{ textDecorationLine: 'underline' }}>Retirar</Txt></Pressy>
        </View>
      )}
    </View>
  );
}

/** Full-screen notice once the room is gone. */
export function IncognitoGone({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 14, backgroundColor: c.bg }}>
      <Icon name="glasses-outline" size={44} tone="muted" />
      <Txt v="h2" style={{ textAlign: 'center', fontFamily: font.typewriter }}>Este chat se autodestruyó</Txt>
      <Txt tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>Los mensajes, archivos y reacciones han desaparecido para los dos. No queda registro.</Txt>
      <Button title="Volver a mis chats" variant="secondary" full={false} onPress={onBack} />
    </View>
  );
}

/** "Chat incógnito con…" from a normal chat: asks for a name for the room and opens it. */
export function IncognitoStartSheet({ visible, onClose, peerId, peerName }: { visible: boolean; onClose: () => void; peerId: string; peerName: string }) {
  const toast = useToast();
  const { refresh } = useChats();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) setTitle(''); }, [visible]);
  const start = async () => {
    setBusy(true);
    try {
      const id = await startIncognitoChat(peerId, title.trim());
      onClose(); refresh();
      router.push({ pathname: '/chat/[id]', params: { id } });
    } catch (e) { toast.show(/blocked/.test(String((e as Error).message)) ? 'No puedes abrir un chat incógnito con alguien bloqueado.' : friendly(e, 'No se pudo crear el chat.'), 'error'); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Chat incógnito">
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: 6, backgroundColor: '#000' }}>
          <Icon name="glasses" size={22} color="#fff" />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="smallStrong" style={{ color: '#fff', fontFamily: font.typewriter }}>{t('Con {name}, en blanco y negro', { name: peerName })}</Txt>
            <Txt v="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>Se autodestruye tras 3 horas sin actividad, o al instante cuando los dos lo pidáis. Al desaparecer no queda nada: ni mensajes, ni archivos, ni registro. Vuestro chat normal no se toca.</Txt>
          </View>
        </View>
        <Field label="Nombre del chat" value={title} onChangeText={setTitle} placeholder="Operación Lince" maxLength={60} autoCapitalize="sentences" hint="Así lo veréis los dos en la lista." />
        <Button title={title.trim() ? t('Abrir «{name}»', { name: title.trim() }) : 'Abrir chat incógnito'} icon="glasses" loading={busy} onPress={start} />
        <Txt v="caption" tone="faint" style={{ textAlign: 'center' }}>{t('{name} verá el chat en su lista con una nota de que es incógnito.', { name: peerName })}</Txt>
      </View>
    </Sheet>
  );
}
