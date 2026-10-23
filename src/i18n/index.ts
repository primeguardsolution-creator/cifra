import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement, Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { router, usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { rows } from './dict';

/** CIFRA speaks Spanish (the source language), English and German. Anything else falls back to English. */
export type Locale = 'es' | 'en' | 'de';
export type LocalePref = 'auto' | Locale;

const maps: Record<'en' | 'de', Record<string, string>> = { en: {}, de: {} };
for (const [es, en, de] of rows) { maps.en[es] = en; maps.de[es] = de; }

/** es → Spanish, de → German, every other language → English. Looks at the device / browser's first language. */
export function detectLocale(): Locale {
  let tag = '';
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    tag = nav?.languages?.[0] ?? nav?.language ?? Intl.DateTimeFormat().resolvedOptions().locale ?? '';
  } catch { /* no language info: English */ }
  const p = tag.toLowerCase().slice(0, 2);
  return p === 'es' ? 'es' : p === 'de' ? 'de' : 'en';
}

let current: Locale = detectLocale();
const listeners = new Set<() => void>();
export const getLocale = () => current;
/** BCP-47 code for Intl / toLocale* calls. */
export const loc = () => current;

export function setLocale(l: Locale) {
  if (l === current) return;
  current = l;
  if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

/** Translates a Spanish source string. Unknown strings are returned untouched (they stay readable in Spanish). */
export function tr(s: string): string {
  if (current === 'es' || !s) return s;
  const hit = maps[current][s];
  if (hit !== undefined) return hit;
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m || !m[2]) return s;
  const core = maps[current][m[2]];
  return core === undefined ? s : m[1] + core + m[3];
}

/** Translates a Spanish template such as "{n} citas" and fills the {placeholders}. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const base = current === 'es' ? key : maps[current][key] ?? key;
  return vars ? base.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : base;
}

const PREF_KEY = 'cifra.locale';
let pref: LocalePref = 'auto';
export const getLocalePref = () => pref;

export function useLocale(): Locale {
  return useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, getLocale, getLocale);
}

export async function setLocalePref(p: LocalePref) {
  pref = p;
  try { await AsyncStorage.setItem(PREF_KEY, p); } catch { /* storage unavailable */ }
  // On the web a reload is the only fully reliable way to re-render every screen (and keeps the router's state untouched).
  if (Platform.OS === 'web' && typeof window !== 'undefined') { window.location.reload(); return; }
  setLocale(p === 'auto' ? detectLocale() : p);
}

/** Applies the saved choice and re-renders the whole tree when the language changes. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const l = useLocale();
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const lastPath = useRef(path);
  lastPath.current = path;
  const seen = useRef(l);
  // The remount below resets the router to its first screen; put the user back where they were (native only: the web reloads).
  useEffect(() => { if (seen.current !== l) { seen.current = l; const back = lastPath.current; setTimeout(() => router.replace(back as never), 0); } }, [l]);
  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then((v) => { if (v === 'es' || v === 'en' || v === 'de') { pref = v; setLocale(v); } }).catch(() => {}).finally(() => setReady(true));
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = current;
  }, []);
  if (!ready) return null;
  return createElement(Fragment, { key: l }, children);
}
