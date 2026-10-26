import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendly } from '../lib/errors';
import { Country, countries, countryMatches, countryName, flag, formatPhone, toE164 } from '../lib/phone';
import { RecoverFlow } from '../features/auth/RecoverFlow';
import { useAuth } from '../state/AuthProvider';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Button, Field, Icon, IconButton, Pressy, Sheet, Txt, Wordmark } from '../ui';
import { t, tr } from '../i18n';

type Mode = 'signIn' | 'register';

export default function Auth() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { user, register, signIn, verifyCode, resendCode, configured } = useAuth();
  const { c } = useTheme();
  const [mode, setMode] = useState<Mode>(params.mode === 'signIn' ? 'signIn' : 'register');
  const [country, setCountry] = useState<Country>(countries[0]);
  const [pickCountry, setPickCountry] = useState(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const phoneRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const isRegister = mode === 'register';

  useEffect(() => { if (params.mode === 'signIn' || params.mode === 'register') setMode(params.mode); }, [params.mode]);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  const filtered = useMemo(() => {
    return query.trim() ? countries.filter((x) => countryMatches(x, query)) : countries;
  }, [query]);

  if (user) return <Redirect href="/chats" />;

  const submit = async () => {
    setError(null);
    const parsed = toE164(country, phone);
    if (!parsed.ok) return setError(parsed.reason);
    if (isRegister && !name.trim()) return setError('Escribe tu nombre: es lo que verán tus contactos.');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (isRegister && !accepted) return setError('Acepta los términos y la política de privacidad para continuar.');
    setBusy(true);
    try {
      if (isRegister) {
        const result = await register({ displayName: name, phone: parsed.e164, password });
        if (result === 'needs-code') { setCodeFor(parsed.e164); setCooldown(30); } else router.replace('/chats');
      } else {
        await signIn(parsed.e164, password);
        router.replace('/chats');
      }
    } catch (e) {
      const msg = friendly(e, e instanceof Error ? e.message : undefined);
      setError(msg);
      if (/ya tiene una cuenta/.test(msg)) setMode('signIn');
    } finally { setBusy(false); }
  };

  const confirmCode = async () => {
    if (!codeFor) return;
    setError(null); setBusy(true);
    try { await verifyCode(codeFor, code); router.replace('/chats'); }
    catch (e) { setError(friendly(e)); } finally { setBusy(false); }
  };

  const resend = async () => {
    if (!codeFor || cooldown > 0) return;
    try { await resendCode(codeFor); setCooldown(30); setError(null); } catch (e) { setError(friendly(e)); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', padding: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ width: '100%', maxWidth: 440, gap: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <IconButton icon="chevron-back" label="Volver" onPress={() => (recovering ? setRecovering(null) : codeFor ? setCodeFor(null) : router.canGoBack() ? router.back() : router.replace('/'))} />
              <Wordmark size={15} />
              <View style={{ width: 40 }} />
            </View>

            {recovering ? (
              <RecoverFlow phone={recovering} onBack={() => setRecovering(null)} onDone={async (pwd) => { await signIn(recovering, pwd); router.replace('/chats'); }} />
            ) : codeFor ? (
              <View style={{ gap: 20, paddingTop: 8 }}>
                <View style={{ gap: 8 }}>
                  <Txt v="h1">Confirma tu número</Txt>
                  <Txt tone="muted">Enviamos un código de 6 dígitos por SMS al <Txt v="bodyStrong">{formatPhone(codeFor)}</Txt>.</Txt>
                </View>
                <Field label="Código" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" placeholder="······" maxLength={6} autoFocus style={{ fontSize: 26, letterSpacing: 8, textAlign: 'center' }} error={error} />
                <Button title="Confirmar y entrar" size="lg" loading={busy} disabled={code.length < 6} onPress={confirmCode} />
                <Button title={cooldown > 0 ? t('Reenviar código en {n}s', { n: cooldown }) : 'Reenviar código'} variant="ghost" disabled={cooldown > 0} onPress={resend} />
              </View>
            ) : (
              <View style={{ gap: 18 }}>
                <View style={{ gap: 8 }}>
                  <Txt v="h1">{isRegister ? 'Crea tu cuenta' : 'Te estábamos esperando'}</Txt>
                  <Txt tone="muted">{isRegister ? 'Tu número de teléfono es tu identidad en CIFRA. Solo puede haber una cuenta por número.' : 'Entra con tu número y tu contraseña.'}</Txt>
                </View>

                <View style={{ flexDirection: 'row', backgroundColor: c.sunken, borderRadius: radius.md, padding: 4 }}>
                  {(['register', 'signIn'] as const).map((m) => (
                    <Pressy key={m} onPress={() => { setMode(m); setError(null); }} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} scale={0.98}
                      style={{ flex: 1, height: 40, borderRadius: radius.md - 4, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === m ? c.surface : 'transparent' }}>
                      <Txt v="smallStrong" tone={mode === m ? 'text' : 'muted'}>{m === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}</Txt>
                    </Pressy>
                  ))}
                </View>

                {isRegister && <Field label="Tu nombre" value={name} onChangeText={setName} placeholder="Cómo te verán los demás" autoCapitalize="words" autoComplete="name" maxLength={60} returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />}

                <Field
                  ref={phoneRef} label="Número de teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="600 123 456" returnKeyType="next" onSubmitEditing={() => passRef.current?.focus()}
                  left={
                    <Pressy onPress={() => setPickCountry(true)} accessibilityRole="button" accessibilityLabel={t('País: {name}', { name: countryName(country) })} scale={0.94} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, borderRightWidth: 1, borderRightColor: c.border, height: 28 }}>
                      <Txt style={{ fontSize: 20 }}>{flag(country.iso)}</Txt>
                      <Txt v="bodyStrong">+{country.dial}</Txt>
                      <Icon name="chevron-down" size={14} tone="muted" />
                    </Pressy>
                  }
                />

                <Field
                  ref={passRef} label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry={!show} placeholder="Mínimo 8 caracteres" autoComplete={isRegister ? 'new-password' : 'current-password'} textContentType={isRegister ? 'newPassword' : 'password'}
                  returnKeyType="go" onSubmitEditing={submit}
                  right={<IconButton icon={show ? 'eye-off' : 'eye'} label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setShow(!show)} tone="muted" size={34} />}
                />

                {isRegister && (
                  <Pressy onPress={() => setAccepted(!accepted)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} scale={0.99} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: accepted ? c.accent : c.borderStrong, backgroundColor: accepted ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                      {accepted && <Icon name="checkmark" size={16} color={c.accentText} />}
                    </View>
                    <Txt v="small" tone="muted" style={{ flex: 1 }}>Acepto los <Txt v="small" tone="accent" onPress={() => router.push('/terms')}>términos de uso</Txt> y la <Txt v="small" tone="accent" onPress={() => router.push('/privacy')}>política de privacidad</Txt>.</Txt>
                  </Pressy>
                )}

                {!configured && <Txt v="small" tone="danger">La app no está conectada al servidor. Falta configurar Supabase.</Txt>}
                {error && <Txt v="small" tone="danger" accessibilityLiveRegion="polite">{error}</Txt>}

                <Button title={isRegister ? 'Crear cuenta' : 'Entrar'} size="lg" loading={busy} onPress={submit} iconRight="arrow-forward" />
                {!isRegister && (
                  <Button title="¿Olvidaste tu contraseña?" variant="ghost" onPress={() => {
                    const parsed = toE164(country, phone);
                    if (!parsed.ok) return setError('Escribe tu número de teléfono y vuelve a pulsar «¿Olvidaste tu contraseña?».');
                    setError(null); setRecovering(parsed.e164);
                  }} />
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={pickCountry} onClose={() => setPickCountry(false)} title="Elige tu país" scroll={false} maxHeight={560}>
        <Field value={query} onChangeText={setQuery} placeholder="Buscar país o prefijo" icon="search" autoCapitalize="none" />
        <ScrollView style={{ maxHeight: 400, marginTop: 10 }} keyboardShouldPersistTaps="handled">
          {filtered.map((x) => (
            <Pressy key={x.iso + x.dial} onPress={() => { setCountry(x); setPickCountry(false); setQuery(''); phoneRef.current?.focus(); }} scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12 }}>
              <Txt style={{ fontSize: 24 }}>{flag(x.iso)}</Txt>
              <Txt v="bodyStrong" style={{ flex: 1 }}>{countryName(x)}</Txt>
              <Txt tone="muted">+{x.dial}</Txt>
              {x.iso === country.iso && <Icon name="checkmark" size={18} tone="accent" />}
            </Pressy>
          ))}
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  );
}
