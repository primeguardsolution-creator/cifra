import { useTheme } from '../theme/ThemeProvider';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Profile, getMyProfile } from '../lib/api';
import { friendly } from '../lib/errors';
import { aliasEmail, phoneFromAlias } from '../lib/phone';
import { isSupabaseConfigured, phoneVerification, supabase } from '../lib/supabase';

export type CifraUser = { id: string; phone: string | null };
type RegisterInput = { displayName: string; phone: string; password: string };

type AuthState = {
  ready: boolean;
  user: CifraUser | null;
  profile: Profile | null;
  configured: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<'signed-in' | 'needs-code'>;
  verifyCode: (phone: string, code: string) => Promise<void>;
  resendCode: (phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
/** In beta ('none') the phone is the identity through an internal alias; in 'sms' mode Supabase handles the phone natively. */
const credentials = (phone: string, password: string) => (phoneVerification === 'sms' ? { phone, password } : { email: aliasEmail(phone), password });
const toPhone = (raw?: string | null) => (raw ? (raw.startsWith('+') ? raw : `+${raw}`) : null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSpace } = useTheme();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<CifraUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) { setReady(true); return; }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Never await Supabase calls inside this callback (it holds the auth lock).
      setUser(session?.user ? { id: session.user.id, phone: toPhone(session.user.phone) ?? phoneFromAlias(session.user.email) } : null);
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') setReady(true);
      if (event === 'SIGNED_OUT') setProfile(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = user?.id;
  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    try { setProfile(await getMyProfile(userId)); } catch { /* keep last known profile */ }
  }, [userId]);
  useEffect(() => { if (userId) refreshProfile(); }, [userId, refreshProfile]);

  const value = useMemo<AuthState>(() => ({
    ready, user, profile, configured: isSupabaseConfigured,
    refreshProfile,
    signIn: async (phone, password) => {
      const { error } = await supabase.auth.signInWithPassword(credentials(phone, password));
      if (error) throw new Error(friendly(error, 'No se pudo iniciar sesión.'));
    },
    register: async ({ displayName, phone, password }) => {
      setSpace('personal');
      const { data, error } = await supabase.auth.signUp({ ...credentials(phone, password), options: { data: { display_name: displayName.trim() } } });
      if (error) throw new Error(friendly(error, 'No se pudo crear la cuenta.'));
      if (data.session) return 'signed-in';
      // The server asked for a one-time code (SMS confirmation enabled).
      if (phoneVerification === 'sms') return 'needs-code';
      const retry = await supabase.auth.signInWithPassword(credentials(phone, password));
      if (retry.error) throw new Error('El servidor aún pide confirmar la cuenta. Desactiva “Confirm email” en Supabase (Auth → Sign In / Providers).');
      return 'signed-in';
    },
    verifyCode: async (phone, code) => {
      const { error } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' });
      if (error) throw new Error(friendly(error, 'El código no es válido.'));
    },
    resendCode: async (phone) => {
      const { error } = await supabase.auth.resend({ type: 'sms', phone });
      if (error) throw new Error(friendly(error, 'No se pudo reenviar el código.'));
    },
    signOut: async () => { await supabase.auth.signOut(); setUser(null); setProfile(null); setSpace('personal'); },
  }), [ready, user, profile, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider.');
  return v;
}
