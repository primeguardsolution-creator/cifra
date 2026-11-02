import { rpc, unwrap } from './api';
import type { IconName } from '../ui';
import { supabase } from './supabase';

export type ActionType = 'appointment' | 'catalog' | 'call' | 'human' | 'link';
export type ChatAction = { type: ActionType; label: string; url?: string | null; enabled?: boolean };

export const ACTION_META: Record<ActionType, { name: string; icon: IconName; hint: string }> = {
  appointment: { name: 'Reservar cita', icon: 'calendar', hint: 'Abre la solicitud de cita del negocio' },
  catalog: { name: 'Ver catálogo', icon: 'pricetags', hint: 'Abre el catálogo del negocio' },
  call: { name: 'Llamar', icon: 'call', hint: 'Llama al equipo por internet' },
  human: { name: 'Hablar con una persona', icon: 'person', hint: 'Avisa al equipo de que el cliente quiere una persona' },
  link: { name: 'Enlace', icon: 'link', hint: 'Abre el enlace que pongas' },
};

/** What customers see until the business configures its own. */
export const defaultActions = (): ChatAction[] => (['appointment', 'catalog', 'call', 'human'] as ActionType[]).map((type) => ({ type, label: ACTION_META[type].name, url: null, enabled: true }));

/** The buttons a customer sees in a business chat (the business's own list, or the defaults while it has none). */
export async function actionsFor(business: string): Promise<ChatAction[]> {
  const r = await rpc<{ configured: boolean; actions: ChatAction[] }>('business_actions_for', { p_business: business });
  return r.configured ? r.actions : defaultActions();
}

/** The team's editable list, including the hidden ones. */
export async function actionsAdmin(business: string): Promise<ChatAction[]> {
  const rows = unwrap(await supabase.from('business_actions').select('type, label, url, enabled').eq('business_id', business).order('position')) as ChatAction[];
  return rows.length ? rows : defaultActions();
}
export const saveActions = (business: string, list: ChatAction[]) => rpc<void>('set_business_actions', { p_business: business, p_actions: list.map((a) => ({ type: a.type, label: a.label.trim() || ACTION_META[a.type].name, url: a.url?.trim() || null, enabled: a.enabled !== false })) });

export const validActionUrl = (u: string) => u.trim() === '' || /^(https:\/\/|tel:|mailto:)\S+$/.test(u.trim());
