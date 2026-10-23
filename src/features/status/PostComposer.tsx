import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUSINESS_POST_DAYS, StatusKind, postStatus } from '../../lib/api';
import { friendly } from '../../lib/errors';
import { bytes } from '../../lib/format';
import { Picked, pickPhoto, pickVideo, uploadMedia } from '../../lib/media';
import { useTheme } from '../../theme/ThemeProvider';
import { statusBackgrounds } from '../../theme/tokens';
import { Button, Field, IconButton, Pressy, Sheet, SheetRow, Txt, useToast } from '../../ui';
import { VideoThumb } from '../chat/VideoPlayer';
import { t, tr } from '../../i18n';

type Props = {
  visible: boolean; onClose: () => void; me: string;
  /** When set, the post is published in the name of this business (public feed, 7 days) instead of as a personal status (24 h). */
  businessId?: string | null;
  onPosted: () => void;
};

/**
 * One composer for personal statuses and business posts: text on a colour, a photo or a video (with an optional caption).
 * Step 1 is a sheet to choose the kind; text opens the full-screen editor, media opens a preview with the caption.
 */
export function PostComposer({ visible, onClose, me, businessId, onPosted }: Props) {
  const { r } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'choose' | 'text' | 'media'>('choose');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(0);
  const [file, setFile] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  useEffect(() => { if (visible) { setStep('choose'); setText(''); setCaption(''); setFile(null); } }, [visible]);
  const biz = !!businessId;
  const folder = biz ? `status/biz/${businessId}` : `status/${me}`;

  const pick = async (kind: 'image' | 'video') => {
    try {
      const f = kind === 'image' ? await pickPhoto({ max: 1600 }) : await pickVideo();
      if (!f) return;
      if (kind === 'video' && (f.size ?? 0) > 25 * 1024 * 1024) return toast.show('El vídeo supera los 25 MB. Recórtalo o elige otro.', 'error');
      setFile(f); setStep('media');
    } catch (e) { toast.show(friendly(e, 'No se pudo abrir la galería.'), 'error'); }
  };
  const publish = async (kind: StatusKind) => {
    if (posting) return;
    setPosting(true);
    try {
      if (kind === 'text') await postStatus(me, { kind, body: text.trim(), bg, business_id: businessId ?? null });
      else {
        const path = await uploadMedia('chat-media', folder, file!);
        await postStatus(me, { kind, media_path: path, body: caption.trim() || undefined, business_id: businessId ?? null });
      }
      toast.show(biz ? t('Publicado · visible {n} días en tu perfil y en Estados', { n: BUSINESS_POST_DAYS }) : 'Estado publicado', 'success');
      onPosted(); onClose();
    } catch (e) { toast.show(friendly(e, 'No se pudo publicar.'), 'error'); } finally { setPosting(false); }
  };

  return (
    <>
      <Sheet visible={visible && step === 'choose'} onClose={onClose} title={biz ? 'Nueva publicación' : 'Nuevo estado'}>
        {biz && <Txt v="small" tone="muted" style={{ marginBottom: 6 }}>{t('Lo verán tus clientes en Estados y cualquiera que abra tu perfil público. Dura {n} días.', { n: BUSINESS_POST_DAYS })}</Txt>}
        <SheetRow icon="text" label="Texto" sub="Escribe algo sobre un fondo de color" onPress={() => setStep('text')} />
        <SheetRow icon="images" label="Foto" sub={biz ? 'Producto, local, equipo… con un pie de foto' : 'Elige una imagen de tu galería'} onPress={() => pick('image')} />
        <SheetRow icon="videocam" label="Vídeo" sub="Hasta 90 segundos · máx. 25 MB" onPress={() => pick('video')} />
      </Sheet>

      <Sheet visible={visible && step === 'media' && !!file} onClose={() => setStep('choose')} title={file?.type.startsWith('video/') ? 'Publicar vídeo' : 'Publicar foto'}>
        {file && (
          <View style={{ gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              {file.type.startsWith('image/') ? <Image source={{ uri: file.uri }} resizeMode="cover" style={{ width: '100%', aspectRatio: 1, maxHeight: 320, borderRadius: r(18) }} />
                : Platform.OS === 'web' ? <VideoThumb url={file.uri} width={300} height={300} onOpen={() => {}} /> : <View style={{ padding: 20 }}><Txt tone="muted">{file.name} · {bytes(file.size)}</Txt></View>}
            </View>
            <Field label={biz ? 'Pie (opcional) · precio, oferta, enlace…' : 'Texto (opcional)'} value={caption} onChangeText={setCaption} multiline maxLength={400} placeholder={biz ? 'Nueva colección de otoño · desde 29 €' : 'Escribe algo'} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Cambiar" variant="secondary" style={{ flex: 1 }} onPress={() => setStep('choose')} />
              <Button title="Publicar" icon="send" style={{ flex: 2 }} loading={posting} onPress={() => publish(file.type.startsWith('video/') ? 'video' : 'image')} />
            </View>
          </View>
        )}
      </Sheet>

      <Modal visible={visible && step === 'text'} animationType="slide" onRequestClose={() => setStep('choose')} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <LinearGradient colors={statusBackgrounds[bg]} style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 }}>
              <IconButton icon="close" label="Cancelar" onPress={() => setStep('choose')} size={46} />
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {statusBackgrounds.map((g, i) => <Pressy key={i} onPress={() => setBg(i)} accessibilityLabel={t('Fondo {n}', { n: i + 1 })} scale={0.85} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: g[1], borderWidth: bg === i ? 3 : 1, borderColor: '#fff' }}><View /></Pressy>)}
              </View>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30, maxWidth: 560, alignSelf: 'center', width: '100%' }}>
              <TextInput value={text} onChangeText={setText} multiline maxLength={400} autoFocus placeholder={tr(biz ? 'Escribe una novedad para tus clientes' : 'Escribe un estado')} placeholderTextColor="rgba(255,255,255,0.6)" selectionColor="#fff" accessibilityLabel={tr('Texto del estado')}
                style={{ color: '#fff', fontSize: 30, lineHeight: 38, textAlign: 'center', fontFamily: 'Inter_700Bold', outlineStyle: 'none' } as object} />
            </View>
            <View style={{ paddingHorizontal: 20, maxWidth: 560, alignSelf: 'center', width: '100%' }}>
              <Button title="Publicar" variant="secondary" size="lg" icon="send" loading={posting} disabled={!text.trim()} onPress={() => publish('text')} />
            </View>
          </LinearGradient>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
