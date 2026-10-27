// CRM (customers, tasks) and Agenda (appointments) for the Business space, plus helpers shared by the Doer assistant.
import { rpc, unwrap } from './api';
import { supabase } from './supabase';
import { loc } from '../i18n';

export type Stage = 'lead' | 'contacted' | 'proposal' | 'won' | 'lost';
export const stages: { key: Stage; label: string; color: string; icon: string }[] = [
  { key: 'lead', label: 'Nuevo', color: '#6B7CFF', icon: 'sparkles' },
  { key: 'contacted', label: 'En contacto', color: '#18B5C8', icon: 'chatbubbles' },
  { key: 'proposal', label: 'Propuesta', color: '#E8890C', icon: 'document-text' },
  { key: 'won', label: 'Ganado', color: '#12A878', icon: 'trophy' },
  { key: 'lost', label: 'Perdido', color: '#8C8C99', icon: 'close-circle' },
];

export type Customer = {
  id: string; business_id: string; user_id: string | null; name: string; phone: string | null; email: string | null; stage: Stage; tags: string[];
  notes: string | null; value_minor: number | null; last_contact_at: string | null; created_at: string;
};
export type Task = { id: string; business_id: string; customer_id: string | null; title: string; due_at: string | null; done: boolean; assigned_to: string | null; created_at: string };
export type ApptStatus = 'requested' | 'scheduled' | 'confirmed' | 'done' | 'cancelled' | 'no_show';
export type Appointment = {
  id: string; business_id: string; customer_id: string | null; customer_user_id: string | null; conversation_id: string | null; title: string; notes: string | null;
  starts_at: string; ends_at: string; status: ApptStatus; assigned_to: string | null;
};
export type MyAppointment = { id: string; business_id: string; business_name: string; logo_path: string | null; title: string; starts_at: string; ends_at: string; status: ApptStatus; notes: string | null; conversation_id: string | null; business_handle: string | null };

export const apptMeta: Record<ApptStatus, { label: string; color: string }> = {
  requested: { label: 'Solicitada', color: '#E8890C' }, scheduled: { label: 'Agendada', color: '#6B7CFF' }, confirmed: { label: 'Confirmada', color: '#12A878' },
  done: { label: 'Hecha', color: '#8C8C99' }, cancelled: { label: 'Cancelada', color: '#D6455D' }, no_show: { label: 'No vino', color: '#D6455D' },
};
/** An appointment with a CIFRA user is an invitation until that person accepts it ("scheduled" → "confirmed"). */
export const isPendingInvite = (a: Pick<Appointment, 'status' | 'customer_user_id'>) => a.status === 'scheduled' && !!a.customer_user_id;
export const apptLabel = (a: Pick<Appointment, 'status' | 'customer_user_id'>) => (isPendingInvite(a) ? 'Pendiente de aceptar' : apptMeta[a.status].label);

const customerCols = 'id, business_id, user_id, name, phone, email, stage, tags, notes, value_minor, last_contact_at, created_at';
export const crmSync = (businessId: string) => rpc<number>('crm_sync', { p_business: businessId });
export async function listCustomers(businessId: string): Promise<Customer[]> {
  return unwrap<Customer[]>(await supabase.from('customers').select(customerCols).eq('business_id', businessId).order('updated_at', { ascending: false }).limit(500));
}
export async function addCustomer(businessId: string, v: { name: string; phone?: string; email?: string; stage?: Stage; notes?: string; tags?: string[] }): Promise<Customer> {
  return unwrap<Customer>(await supabase.from('customers').insert({ business_id: businessId, name: v.name.trim(), phone: v.phone?.trim() || null, email: v.email?.trim() || null, stage: v.stage ?? 'lead', notes: v.notes?.trim() || null, tags: v.tags ?? [] }).select(customerCols).single());
}
export async function updateCustomer(id: string, patch: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'stage' | 'tags' | 'notes' | 'value_minor'>>): Promise<Customer> {
  return unwrap<Customer>(await supabase.from('customers').update(patch).eq('id', id).select(customerCols).single());
}
/** Team: adds a CIFRA account (found by @username or phone) as a customer; it shares its name, photo and @username with the team. */
export const addCustomerFromUser = (businessId: string, userId: string) => rpc<string>('add_customer_from_user', { p_business: businessId, p_user: userId });
export async function deleteCustomer(id: string) { unwrap(await supabase.from('customers').delete().eq('id', id)); }

const taskCols = 'id, business_id, customer_id, title, due_at, done, assigned_to, created_at';
export async function listTasks(businessId: string): Promise<Task[]> {
  return unwrap<Task[]>(await supabase.from('crm_tasks').select(taskCols).eq('business_id', businessId).order('done').order('due_at', { ascending: true, nullsFirst: false }).limit(300));
}
export async function addTask(businessId: string, v: { title: string; due_at?: string | null; customer_id?: string | null }): Promise<Task> {
  return unwrap<Task>(await supabase.from('crm_tasks').insert({ business_id: businessId, title: v.title.trim(), due_at: v.due_at ?? null, customer_id: v.customer_id ?? null }).select(taskCols).single());
}
export async function setTaskDone(id: string, done: boolean) { unwrap(await supabase.from('crm_tasks').update({ done, done_at: done ? new Date().toISOString() : null }).eq('id', id)); }
export async function deleteTask(id: string) { unwrap(await supabase.from('crm_tasks').delete().eq('id', id)); }

const apptCols = 'id, business_id, customer_id, customer_user_id, conversation_id, title, notes, starts_at, ends_at, status, assigned_to';
export async function listAppointments(businessId: string, from: Date, to: Date): Promise<Appointment[]> {
  return unwrap<Appointment[]>(await supabase.from('appointments').select(apptCols).eq('business_id', businessId).gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString()).order('starts_at').limit(500));
}
export async function listRequestedAppointments(businessId: string): Promise<Appointment[]> {
  return unwrap<Appointment[]>(await supabase.from('appointments').select(apptCols).eq('business_id', businessId).eq('status', 'requested').order('starts_at').limit(100));
}
/** `user` invites any CIFRA account (person or business owner) — it becomes a customer card and gets the invitation in its chat. */
export const createAppointment = (v: { business: string; customer?: string | null; user?: string | null; title: string; start: Date; end: Date; notes?: string; assigned?: string | null }) =>
  rpc<string>('create_appointment', { p_business: v.business, p_customer: v.customer ?? null, p_title: v.title, p_start: v.start.toISOString(), p_end: v.end.toISOString(), p_notes: v.notes ?? null, p_assigned: v.assigned ?? null, p_user: v.user ?? null });
/** Team: opens (creating it if needed) the business chat with a customer card. Links the card to the account when only the phone was known. */
export const startCustomerChat = (customerId: string) => rpc<string>('start_customer_chat', { p_customer: customerId });
export const updateAppointment = (id: string, v: { status?: ApptStatus; start?: Date; end?: Date; title?: string; notes?: string }) =>
  rpc<void>('update_appointment', { p_id: id, p_status: v.status ?? null, p_start: v.start?.toISOString() ?? null, p_end: v.end?.toISOString() ?? null, p_title: v.title ?? null, p_notes: v.notes ?? null });
export const requestAppointment = (business: string, start: Date, note?: string) => rpc<string>('request_appointment', { p_business: business, p_start: start.toISOString(), p_note: note ?? null });
export const respondAppointment = (id: string, status: 'confirmed' | 'cancelled') => rpc<void>('respond_appointment', { p_id: id, p_status: status });
export const myAppointments = () => rpc<MyAppointment[]>('my_appointments');

// ── Dates ──
export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const hm = (iso: string | Date) => new Date(iso).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
export const longDay = (d: Date) => d.toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' });

/** Parses the "📅 Etiqueta · Título · 2026-10-30T10:00Z" card the server posts into a chat. */
export function parseApptCard(body: string | null): { label: string; title: string; start: Date; id: string | null } | null {
  const m = body?.match(/^📅\s*(.+?)\s·\s(.+)\s·\s(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)(?:\s·\s([0-9a-f-]{36}))?$/);
  return m ? { label: m[1], title: m[2], start: new Date(m[3]), id: m[4] ?? null } : null;
}
export async function getAppointment(id: string): Promise<Appointment | null> {
  return unwrap<Appointment | null>(await supabase.from('appointments').select(apptCols).eq('id', id).maybeSingle());
}

// ── Broadcasts ("Difusión") ──
export type BroadcastRow = { id: string; body: string; recipients: number; created_at: string; sent_by_name: string | null };
export const broadcastAudience = async (business: string, stage: Stage | null, tag: string | null) =>
  (await rpc<{ total: number; reachable: number }[]>('broadcast_audience', { p_business: business, p_stage: stage, p_tag: tag || null }))[0] ?? { total: 0, reachable: 0 };
export const sendBroadcast = (business: string, body: string, stage: Stage | null, tag: string | null) => rpc<number>('send_broadcast', { p_business: business, p_body: body, p_stage: stage, p_tag: tag || null });
export const listBroadcasts = (business: string) => rpc<BroadcastRow[]>('list_broadcasts', { p_business: business });
export const broadcastOptOut = (business: string, out = true) => rpc<void>('broadcast_optout', { p_business: business, p_out: out });

/** Customer side: the team members who can take a call in this business chat (the assigned agent, or the whole front desk). */
export const businessCallTargets = (conversationId: string) => rpc<{ user_id: string; display_name: string; avatar_path: string | null }[]>('business_call_targets', { p_conv: conversationId });
/** Team: opens (or reuses) the negotiation room with a customer: a group chat with files, polls and group calls. */
export const startNegotiation = (businessId: string, customerId: string, members: string[] = []) => rpc<string>('start_negotiation', { p_business: businessId, p_customer: customerId, p_members: members });
export type Negotiation = { conversation_id: string; customer_id: string; customer_name: string; members: number; created_at: string; last_at: string | null };
export const listNegotiations = (businessId: string) => rpc<Negotiation[]>('list_negotiations', { p_business: businessId });
