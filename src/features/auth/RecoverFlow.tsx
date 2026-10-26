import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { friendly } from '../../lib/errors';
import { formatPhone } from '../../lib/phone';
import { finishReset, startReset } from '../../lib/recovery';
import { Button, Field, IconButton, Txt } from '../../ui';
import { t } from '../../i18n';

type Step = 'choose' | 'email' | 'code';

/** "Olvidé mi contraseña": a code sent to the verified e-mail, or the one-time recovery code saved at sign-up; then a new password. */
export function RecoverFlow({ phone, onBack, onDone }: { phone: string; onBack: () => void; onDone: (password: string) => Promise<void> }) {
  const [step, setStep] = useState<Step>('choose');
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (cooldown <= 0) return; const id = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(id); }, [cooldown]);

  const sendEmail = async () => {
    setBusy(true); setError(null);
    try { await startReset(phone); setStep('email'); setCooldown(60); } catch (e) { setError(friendly(e)); } finally { setBusy(false); }
  };
  const finish = async (method: 'email' | 'code') => {
    if (password.length < 8) return setError(friendly('weak_password'));
    setBusy(true); setError(null);
    try { await finishReset(phone, method, secret, password); await onDone(password); } catch (e) { setError(friendly(e)); } finally { setBusy(false); }
  };

  const passwordField = (
    <Field label="Nueva contraseña" value={password} onChangeText={setPassword} secureTextEntry={!show} placeholder="Mínimo 8 caracteres" autoComplete="new-password"
      right={<IconButton icon={show ? 'eye-off' : 'eye'} label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setShow(!show)} tone="muted" size={34} />} />
  );

  return (
    <View style={{ gap: 18, paddingTop: 8 }}>
      <View style={{ gap: 8 }}>
        <Txt v="h1">Recupera tu cuenta</Txt>
        <Txt tone="muted">{t('Cuenta del número {phone}.', { phone: formatPhone(phone) })}</Txt>
      </View>

      {step === 'choose' && (
        <View style={{ gap: 12 }}>
          <Button title="Recibir un código por correo" icon="mail" size="lg" loading={busy} onPress={sendEmail} />
          <Txt v="caption" tone="muted">Si tu cuenta tiene un correo verificado, te enviamos un código de 6 dígitos.</Txt>
          <Button title="Tengo mi código de recuperación" icon="key" variant="secondary" size="lg" onPress={() => { setSecret(''); setError(null); setStep('code'); }} />
          <Txt v="caption" tone="muted">Es el código de 12 caracteres (XXXX-XXXX-XXXX) que guardaste al crear tu cuenta o desde Ajustes.</Txt>
          <Button title="Volver" variant="ghost" onPress={onBack} />
        </View>
      )}

      {step === 'email' && (
        <View style={{ gap: 14 }}>
          <Txt tone="muted">Escribe el código que te enviamos por correo (revisa también el spam) y elige tu nueva contraseña.</Txt>
          <Field label="Código del correo" value={secret} onChangeText={(v) => setSecret(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="······" maxLength={6} autoFocus />
          {passwordField}
          <Button title="Cambiar contraseña y entrar" size="lg" loading={busy} disabled={secret.length < 6 || password.length < 8} onPress={() => finish('email')} />
          <Button title={cooldown > 0 ? t('Reenviar código en {n}s', { n: cooldown }) : 'Reenviar código'} variant="ghost" disabled={cooldown > 0 || busy} onPress={sendEmail} />
          <Button title="Usar mi código de recuperación" variant="ghost" onPress={() => { setSecret(''); setError(null); setStep('code'); }} />
        </View>
      )}

      {step === 'code' && (
        <View style={{ gap: 14 }}>
          <Field label="Código de recuperación" value={secret} onChangeText={(v) => setSecret(v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14))} autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX" autoFocus />
          {passwordField}
          <Button title="Cambiar contraseña y entrar" size="lg" loading={busy} disabled={secret.replace(/[^A-Z0-9]/g, '').length < 12 || password.length < 8} onPress={() => finish('code')} />
          <Button title="Prefiero recibir un código por correo" variant="ghost" onPress={() => { setSecret(''); setError(null); setStep('choose'); }} />
        </View>
      )}
      {error && <Txt tone="danger" accessibilityLiveRegion="polite">{error}</Txt>}
    </View>
  );
}
