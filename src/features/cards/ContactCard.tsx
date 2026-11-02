import { router } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { saveContact, startDirectChat } from '../../lib/api';
import { SharedContact } from '../../lib/chatCards';
import { friendly } from '../../lib/errors';
import { fileArt } from '../../lib/fileKind';
import { useAuth } from '../../state/AuthProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Pressy, Txt, useToast } from '../../ui';
import { tr } from '../../i18n';

/** A shared contact: opens their profile, starts a chat, or saves them to your contacts. */
export function ContactCard({ contact, mine }: { contact: SharedContact; mine: boolean }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const me = contact.id === user?.id;
  const fg = mine ? c.bubbleOutText : c.bubbleInText;
  const link = { color: mine ? c.bubbleOutText : c.accent, fontFamily: 'Inter_600SemiBold' } as const;
  const act = async (fn: () => Promise<unknown>, ok?: string) => { setBusy(true); try { await fn(); if (ok) toast.show(ok, 'success'); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(false); } };
  return (
    <View style={{ width: 250, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {fileArt.contact ? <Image source={fileArt.contact} resizeMode="contain" style={{ width: 48, height: 48 }} /> : null}
        <Avatar name={contact.name} seed={contact.id} size={42} />
        <View style={{ flex: 1 }}><Txt v="smallStrong" numberOfLines={2} style={{ color: fg }}>{contact.name}</Txt><Txt v="caption" style={{ color: mine ? c.bubbleOutMeta : c.textMuted }}>{tr('Contacto')}</Txt></View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Pressy onPress={() => router.push({ pathname: '/user/[id]', params: { id: contact.id } })} accessibilityRole="link" scale={0.95}><Txt v="caption" style={link}>{tr('Ver perfil')}</Txt></Pressy>
        {!me && <Pressy disabled={busy} onPress={() => act(async () => { const cid = await startDirectChat(contact.id); router.push({ pathname: '/chat/[id]', params: { id: cid } }); })} accessibilityRole="button" scale={0.95}><Txt v="caption" style={link}>{tr('Escribir')}</Txt></Pressy>}
        {!me && !mine && user && <Pressy disabled={busy} onPress={() => act(() => saveContact(user.id, { display_name: contact.name, phone: null, contact_user_id: contact.id }), 'Contacto guardado')} accessibilityRole="button" scale={0.95}><Txt v="caption" style={link}>{tr('Guardar contacto')}</Txt></Pressy>}
      </View>
    </View>
  );
}
