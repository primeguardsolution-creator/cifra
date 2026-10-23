import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { BotAction } from './knowledge';
import type { Chip, Reply } from './engine';

export type BotMsg = {
  id: string;
  from: 'me' | 'bot';
  text: string;
  at: string;
  actions?: BotAction[];
  chips?: Chip[];
  menu?: Reply['menu'];
  ai?: boolean;
};

type State = { userId: string | null; msgs: BotMsg[]; seen: boolean; loaded: boolean };

const MAX = 120;
const key = (uid: string) => `cifra.assistant.v1.${uid}`;
let state: State = { userId: null, msgs: [], seen: true, loaded: false };
const subs = new Set<() => void>();
const emit = () => { state = { ...state }; subs.forEach((f) => f()); };

let n = 0;
export const newId = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

async function persist() {
  if (!state.userId) return;
  try { await AsyncStorage.setItem(key(state.userId), JSON.stringify({ msgs: state.msgs.slice(-MAX), seen: state.seen })); } catch { /* storage unavailable: keep in memory */ }
}

export const assistantStore = {
  async load(userId: string) {
    if (state.userId === userId && state.loaded) return;
    state = { userId, msgs: [], seen: true, loaded: false };
    try {
      const raw = await AsyncStorage.getItem(key(userId));
      if (raw) { const p = JSON.parse(raw) as { msgs?: BotMsg[]; seen?: boolean }; state = { userId, msgs: p.msgs ?? [], seen: p.seen ?? true, loaded: true }; }
      else state = { userId, msgs: [], seen: false, loaded: true }; // brand-new user: the welcome is waiting, show it as unread
    } catch { state = { userId, msgs: [], seen: true, loaded: true }; }
    emit();
  },
  add(m: Omit<BotMsg, 'id' | 'at'> & { id?: string; at?: string }) {
    const full: BotMsg = { id: m.id ?? newId(), at: m.at ?? new Date().toISOString(), ...m };
    state.msgs = [...state.msgs, full].slice(-MAX);
    // Offers (chips/actions) only make sense under the latest bot message.
    const lastBot = [...state.msgs].reverse().find((x) => x.from === 'bot');
    state.msgs = state.msgs.map((x) => (x.from === 'bot' && x !== lastBot && (x.chips || x.menu) ? { ...x, chips: undefined, menu: undefined } : x));
    emit(); persist();
    return full;
  },
  markSeen() { if (!state.seen) { state.seen = true; emit(); persist(); } },
  clear() { state.msgs = []; state.seen = true; emit(); persist(); },
  /** Bot message that should look unread (welcome); the screen marks it seen once opened. */
  get(): State { return state; },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  reset() { state = { userId: null, msgs: [], seen: true, loaded: false }; emit(); },
};

export function useAssistantState(): State {
  return useSyncExternalStore(assistantStore.subscribe, assistantStore.get, assistantStore.get);
}

/** Plain-text preview for the chat list (drops the markdown-lite markers). */
export function plain(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/•\s*/g, '· ').replace(/\s*\n+\s*/g, ' ').trim();
}
