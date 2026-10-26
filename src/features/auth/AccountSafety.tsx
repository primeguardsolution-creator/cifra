import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { friendly } from '../../lib/errors';
import { RecoveryStatus, confirmEmail, makeRecoveryCode, recoveryStatus, startEmail } from '../../lib/recovery';
import { useAuth } from '../../state/AuthProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Field, Icon, Pressy, Sheet, Txt, useToast } from '../../ui';
import { t } from '../../i18n';

const REPROMPT_MS = 3 * 24 * 3600e3;

/** Everything about getting back into the account: a verified e-mail (6-digit code) and a one-time recovery code. Used from Settings and as a first-run prompt. */
export function SafetySheet({ visible, onClose, onChanged }: { visible: boolean; onClose: () => void; onChanged?: (s: RecoveryStatus | null) => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'code' | 'email' | 'otp' | null>(null);

  const load = useCallback(async () => { const s = await recoveryStatus().catch(() => null); setStatus(s); onChanged?.(s); }, [onChanged]);
  useEffect(() => { if (visible) { load(); setSent(false); setOtp(''); } }, [visible, load]);

  const createCode = async () => {
    setBusy('code');
    try { const r = await makeRecoveryCode(); setCode(r.code); setSaved(false); await load(); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(null); }
  };
  const copy = async () => { if (code) { await Clipboard.setStringAsync(code); toast.show('Código copiado', 'success'); } };
  const sendEmail = async () => {
    setBusy('email');
    try { await startEmail(email); setSent(true); toast.show('Te enviamos un código de 6 dígitos', 'success'); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(null); }
  };
  const verify = async () => {
    setBusy('otp');
    try { await confirmEmail(otp); setSent(false); setOtp(''); setEmail(''); toast.show('Correo verificado', 'success'); await load(); } catch (e) { toast.show(friendly(e), 'error'); } finally { setBusy(null); }
  };
  const close = () => { if (code && !saved) { toast.show('Guarda tu código antes de cerrar: no volverá a mostrarse.', 'info'); return; } setCode(null); onClose(); };

  return (
    <Sheet visible={visible} onClose={close} title="Seguridad de la cuenta">
      <View style={{ gap: 16 }}>
        <Txt v="small" tone="muted">Si olvidas tu contraseña, estas dos cosas te devuelven el acceso. Sin ellas no podemos ayudarte.</Txt>

        <View style={{ gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="key" size={18} tone="accent" />
            <Txt v="bodyStrong" style={{ flex: 1 }}>Código de recuperación</Txt>
            {status?.has_code && !code ? <Txt v="caption" tone="accent">Activo</Txt> : null}
          </View>
          {code ? (
            <>
              <View style={{ alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: c.sunken }}><Txt style={{ fontFamily: 'GeistMono_500Medium', fontSize: 24, letterSpacing: 2 }} selectable>{code}</Txt></View>
              <Txt v="caption" tone="muted">Guárdalo ahora (captura, gestor de contraseñas o papel). Solo se muestra una vez y sirve una sola vez.</Txt>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Copiar" icon="copy" variant="secondary" style={{ flex: 1 }} onPress={copy} />
                <Button title={saved ? 'Guardado ✓' : 'Ya lo guardé'} icon="checkmark" style={{ flex: 1 }} variant={saved ? 'soft' : 'primary'} onPress={() => { setSaved(true); setCode(null); }} />
              </View>
            </>
          ) : (
            <>
              <Txt v="small" tone="muted">{status?.has_code ? 'Ya tienes uno. Si lo perdiste o lo usaste, crea otro (el anterior deja de valer).' : 'Un código de 12 caracteres que guardas tú. Sirve para entrar aunque no tengas correo.'}</Txt>
              <Button title={status?.has_code ? 'Crear un código nuevo' : 'Crear mi código de recuperación'} icon="refresh" variant={status?.has_code ? 'secondary' : 'primary'} loading={busy === 'code'} onPress={createCode} />
            </>
          )}
        </View>

        <View style={{ gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="mail" size={18} tone="accent" />
            <Txt v="bodyStrong" style={{ flex: 1 }}>Correo de recuperación</Txt>
            {status?.email_verified ? <Txt v="caption" tone="accent">Verificado</Txt> : null}
          </View>
          {status?.email_verified && !sent ? <Txt v="small" tone="muted">{status.email_masked} · puedes cambiarlo escribiendo otro.</Txt> : <Txt v="small" tone="muted">Te enviamos un código de 6 dígitos para confirmar que el correo es tuyo.</Txt>}
          {!sent ? (
            <>
              <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="tu@correo.com" />
              <Button title={status?.email_verified ? 'Cambiar correo' : 'Enviar código'} icon="send" loading={busy === 'email'} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())} onPress={sendEmail} />
            </>
          ) : (
            <>
              <Field label="Código del correo" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="······" maxLength={6} autoFocus />
              <Button title="Confirmar correo" icon="checkmark" loading={busy === 'otp'} disabled={otp.length < 6} onPress={verify} />
              <Button title="Usar otro correo" variant="ghost" onPress={() => { setSent(false); setOtp(''); }} />
            </>
          )}
        </View>
        <Button title="Cerrar" variant="ghost" onPress={close} />
      </View>
    </Sheet>
  );
}

/** First-run nudge: shows the safety sheet to anyone who has no recovery code yet (again after 3 days if they postpone). */
export function AccountSafetyPrompt() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const key = `cifra.safetyDismissed.${user?.id ?? ''}`;
  useEffect(() => {
    if (!user || !profile) return;
    let live = true;
    (async () => {
      const s = await recoveryStatus().catch(() => null);
      if (!live || !s || s.has_code) return;
      const last = Number(await AsyncStorage.getItem(key).catch(() => null)) || 0;
      if (Date.now() - last > REPROMPT_MS) setOpen(true);
    })();
    return () => { live = false; };
  }, [user?.id, !!profile]); // eslint-disable-line react-hooks/exhaustive-deps
  const later = () => { AsyncStorage.setItem(key, String(Date.now())).catch(() => {}); setOpen(false); };
  return <SafetySheet visible={open} onClose={later} />;
}

export const safetySummary = (s: RecoveryStatus | null) => (!s ? '' : s.has_code && s.email_verified ? t('Código de recuperación y correo {mail}', { mail: s.email_masked ?? '' }) : s.has_code ? 'Código de recuperación creado · falta verificar un correo' : s.email_verified ? 'Correo verificado · falta crear tu código de recuperación' : 'Sin protección: crea tu código de recuperación');
