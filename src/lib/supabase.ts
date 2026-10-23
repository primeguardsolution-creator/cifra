import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** 'sms' = phone number must be confirmed with a one-time code. 'none' = beta mode (uniqueness only). */
export const phoneVerification: 'sms' | 'none' = process.env.EXPO_PUBLIC_PHONE_VERIFICATION === 'sms' ? 'sms' : 'none';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(supabaseUrl || 'https://not-configured.invalid', supabasePublishableKey || 'not-configured', {
  auth: {
    storage: Platform.OS === 'web' ? AsyncStorage : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: { params: { eventsPerSecond: 20 } },
});
