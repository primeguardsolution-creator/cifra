import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** True when the person asked the system for less motion (every animation below falls back to a static state). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const q = window.matchMedia('(prefers-reduced-motion: reduce)');
      const on = () => setReduced(q.matches);
      on(); q.addEventListener?.('change', on);
      return () => q.removeEventListener?.('change', on);
    }
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setReduced(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; sub.remove(); };
  }, []);
  return reduced;
}

/** Non-hook read for code that only runs once on mount. */
export function prefersReducedMotion(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Personal ⇄ Business: remembers when and in which direction the space changed, so the rows of the new inbox can slide in (and only then, not when scrolling). */
let switched = { at: 0, dir: 1 };
export const markSpaceSwitch = (to: 'personal' | 'business') => { switched = { at: Date.now(), dir: to === 'business' ? 1 : -1 }; };
export const recentSpaceSwitch = () => (Date.now() - switched.at < 700 ? switched : null);

/** Inbox row → conversation: the window position of the avatar that was tapped, so the chat header can fly it into place. */
let shared: { conv: string; x: number; y: number; size: number; at: number } | null = null;
export const setSharedAvatar = (conv: string, x: number, y: number, size: number) => { shared = { conv, x, y, size, at: Date.now() }; };
export const takeSharedAvatar = (conv: string) => { const s = shared; shared = null; return s && s.conv === conv && Date.now() - s.at < 1500 ? s : null; };
