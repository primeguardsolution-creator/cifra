import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../state/AuthProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Logo, Pressy, Txt } from '../../ui';
import { hapticSoft, hapticTap } from '../../lib/haptics';
import { t } from '../../i18n';

const KEY = 'cifra.lock.v1';
const PIN_LENGTH = 6;
const IDLE_MS = 60_000;

type Stored = { salt: string; hash: string };
type Ctx = { available: boolean; enabled: boolean; setPin: (pin: string) => Promise<void>; disable: () => Promise<void>; verify: (pin: string) => Promise<boolean>; lockNow: () => void };
const LockCtx = createContext<Ctx>({ available: false, enabled: false, setPin: async () => {}, disable: async () => {}, verify: async () => false, lockNow: () => {} });
export const useLock = () => useContext(LockCtx);
export const PIN_DIGITS = PIN_LENGTH;

const toHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function derive(pin: string, salt: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150_000, hash: 'SHA-256' }, key, 256));
}

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const available = Platform.OS === 'web' && typeof crypto !== 'undefined' && !!crypto.subtle;
  const storageKey = `${KEY}.${user?.id ?? ''}`;
  const [stored, setStored] = useState<Stored | null>(null);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(storageKey).then((v) => { if (!live) return; const s = v ? (JSON.parse(v) as Stored) : null; setStored(s); setLocked(!!s); setReady(true); }).catch(() => live && setReady(true));
    return () => { live = false; };
  }, [storageKey]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onChange = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (stored && hiddenAt.current && Date.now() - hiddenAt.current > IDLE_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [stored]);

  const value = useMemo<Ctx>(() => ({
    available, enabled: !!stored,
    setPin: async (pin) => {
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
      const next = { salt, hash: await derive(pin, salt) };
      await AsyncStorage.setItem(storageKey, JSON.stringify(next)); setStored(next);
    },
    disable: async () => { await AsyncStorage.removeItem(storageKey); setStored(null); setLocked(false); },
    verify: async (pin) => { if (!stored) return true; const ok = (await derive(pin, stored.salt)) === stored.hash; if (ok) setLocked(false); return ok; },
    lockNow: () => { if (stored) setLocked(true); },
  }), [available, stored, storageKey]);

  return (
    <LockCtx.Provider value={value}>
      {children}
      {available && (!ready || (locked && !!stored)) ? <LockScreen cover={!ready} verify={value.verify} onForgot={async () => { await AsyncStorage.removeItem(storageKey); await signOut(); }} /> : null}
    </LockCtx.Provider>
  );
}

/** Keypad used both to unlock and to create a PIN. */
export function PinPad({ title, subtitle, error, onComplete, shake }: { title: string; subtitle?: string; error?: string | null; onComplete: (pin: string) => void; shake?: number }) {
  const { c } = useTheme();
  const [pin, setPin] = useState('');
  const x = useRef(new Animated.Value(0)).current;
  const native = Platform.OS !== 'web';

  const push = useCallback((d: string) => setPin((cur) => (cur.length >= PIN_LENGTH ? cur : cur + d)), []);
  useEffect(() => { if (pin.length === PIN_LENGTH) { const done = pin; const t = setTimeout(() => { onComplete(done); setPin(''); }, 120); return () => clearTimeout(t); } }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!shake) return; hapticSoft(); Animated.sequence([-1, 1, -0.7, 0.7, 0].map((v) => Animated.timing(x, { toValue: v, duration: 60, useNativeDriver: native }))).start(); }, [shake, x, native]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    // capture phase + preventDefault: the digits must never reach a text field hidden under the lock screen
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); push(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); setPin((p) => p.slice(0, -1)); }
    };
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [push]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ alignItems: 'center', gap: 22, width: '100%', maxWidth: 320 }}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Txt v="h2" style={{ textAlign: 'center' }}>{title}</Txt>
        {subtitle ? <Txt v="small" tone="muted" style={{ textAlign: 'center' }}>{subtitle}</Txt> : null}
      </View>
      <Animated.View style={{ flexDirection: 'row', gap: 14, height: 18, transform: [{ translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] }) }] }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => <View key={i} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: error ? c.danger : c.accent, backgroundColor: i < pin.length ? (error ? c.danger : c.accent) : 'transparent' }} />)}
      </Animated.View>
      <Txt v="small" tone="danger" style={{ minHeight: 18, textAlign: 'center' }} accessibilityLiveRegion="polite">{error ?? ' '}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 3 * 84 + 24, justifyContent: 'center', gap: 12 }}>
        {keys.map((k, i) => k === '' ? <View key={i} style={{ width: 72, height: 72 }} /> : (
          <Pressy key={i} onPress={() => { hapticTap(); if (k === '⌫') setPin((p) => p.slice(0, -1)); else push(k); }} scale={0.88} accessibilityRole="button" accessibilityLabel={k === '⌫' ? 'Borrar' : k}
            style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: k === '⌫' ? 'transparent' : c.surface, borderWidth: k === '⌫' ? 0 : 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            {k === '⌫' ? <Icon name="backspace-outline" size={26} tone="muted" /> : <Txt style={{ fontSize: 28, lineHeight: 34, fontFamily: 'Inter_500Medium' }}>{k}</Txt>}
          </Pressy>
        ))}
      </View>
    </View>
  );
}

function LockScreen({ verify, onForgot, cover }: { verify: (pin: string) => Promise<boolean>; onForgot: () => void; cover?: boolean }) {
  const { c } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [until, setUntil] = useState(0);
  const [shake, setShake] = useState(0);

  const attempt = async (pin: string) => {
    if (Date.now() < until) { setError('Demasiados intentos. Espera un momento.'); setShake((s) => s + 1); return; }
    if (await verify(pin)) { setError(null); return; }
    const n = fails + 1; setFails(n); setShake((s) => s + 1);
    if (n >= 5) { setUntil(Date.now() + 30_000); setFails(0); setError('Demasiados intentos. Espera 30 segundos.'); } else setError(t('PIN incorrecto · {n} intentos restantes', { n: 5 - n }));
  };

  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, zIndex: 2500, backgroundColor: c.bg } as object}>
      {!cover && (
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 26 }}>
          <Logo size={72} />
          <PinPad title="CIFRA está bloqueado" subtitle="Introduce tu PIN de 6 dígitos" error={error} shake={shake} onComplete={attempt} />
          <Pressy onPress={onForgot} accessibilityRole="button" scale={0.96}><Txt v="small" tone="accent">¿Olvidaste tu PIN? Cerrar sesión</Txt></Pressy>
        </SafeAreaView>
      )}
    </View>
  );
}
