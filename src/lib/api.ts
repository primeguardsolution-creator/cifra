import { friendly } from './errors';
import { supabase } from './supabase';

// ───────── Types ─────────
export type ConversationState = 'open' | 'pending' | 'resolved' | 'closed';
export type BusinessRole = 'owner' | 'admin' | 'supervisor' | 'agent' | 'viewer';

export type Profile = { id: string; display_name: string; username: string | null; bio: string | null; avatar_path: string | null; cover_path: string | null; phone: string | null; phone_verified: boolean; discoverable: boolean; hide_phone: boolean };
export type PersonCard = { id: string; display_name: string; avatar_path: string | null; phone: string | null; bio?: string | null; username?: string | null; created_at?: string | null; cover_path?: string | null };
/** Result of the @username search: never carries a phone number. */
export type UserHit = { id: string; display_name: string; username: string; avatar_path: string | null; is_self: boolean; is_contact: boolean };

export type Chat = {
  id: string; kind: 'direct' | 'group' | 'business'; title: string | null; state: ConversationState; business_id: string | null; assigned_to: string | null;
  perspective: 'personal' | 'agent'; created_at: string; peer_id: string | null; peer_name: string | null; peer_avatar: string | null; peer_phone: string | null;
  business_name: string | null; business_handle: string | null; member_count: number; last_message_id: string | null; last_body: string | null; last_sender: string | null;
  last_attachment_type: string | null; last_deleted: boolean | null; last_internal: boolean | null; last_at: string | null; unread: number; muted_until: string | null; pinned_at: string | null; archived: boolean; marked_unread: boolean;
  /** Incognito rooms: named, self-destructing after 3 h of silence (`expires_at`) or when both sides ask (`destroy_*`). */
  incognito: boolean; expires_at: string | null; destroy_mine: boolean; destroy_peer: boolean;
  /** Receipts for the last message when I sent it: delivered to the other device / read by them. */
  last_delivered: boolean; last_read: boolean;
  /** Who wrote the last message (a business shows its own name for automated replies): name and photo for the list preview. */
  last_sender_name: string | null; last_sender_avatar: string | null;
};

export type Message = {
  id: string; conversation_id: string; sender_id: string; body: string | null; attachment_path: string | null; attachment_type: string | null;
  attachment_name: string | null; attachment_size: number | null; attachment_duration_ms: number | null; reply_to_id: string | null; edited_at: string | null; deleted_at: string | null;
  created_at: string; is_internal: boolean; is_automated: boolean; pending?: boolean; failed?: boolean; localUri?: string;
};
export type Reaction = { message_id: string; user_id: string; emoji: string };

export type BizAccent = 'amber' | 'cobalt' | 'jade' | 'ruby' | 'orchid';
export type Business = {
  id: string; name: string; handle: string | null; description: string | null; category: string | null; email: string | null; phone: string | null; website: string | null;
  address: string | null; logo_path: string | null; cover_path: string | null; accent: BizAccent; greeting: string | null; away_message: string | null; away_enabled: boolean; is_public: boolean; owner_id: string; show_phone: boolean;
};
export type BusinessMembership = { role: BusinessRole; business: Business };
export type TeamMember = { user_id: string; role: BusinessRole; display_name: string; avatar_path: string | null; phone: string | null; joined_at: string };
export type CatalogItem = { id: string; business_id: string; name: string; description: string | null; price_minor: number | null; currency: string | null; image_path: string | null; is_published: boolean };
export type QuickReply = { id: string; business_id: string; shortcut: string; body: string };
export type ContactRow = { id: string; display_name: string; phone: string | null; contact_user_id: string | null };
export type StatusKind = 'text' | 'image' | 'video';
/** A status (24 h, personal) or a business post (`business_id` set, up to 7 days, public feed). */
export type StatusRow = { id: string; user_id: string; kind: StatusKind; body: string | null; bg: number; media_path: string | null; created_at: string; expires_at: string; business_id: string | null };

// ───────── Helpers ─────────
export type PgError = { message: string } | null;
export function unwrap<T>(res: { data: T | null; error: PgError }, fallback?: string): T {
  if (res.error) throw new Error(friendly(res.error, fallback));
  return res.data as T;
}
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  return unwrap<T>(await supabase.rpc(fn, args) as { data: T | null; error: PgError });
}

// ───────── Profile ─────────
const profileCols = 'id, display_name, username, bio, avatar_path, cover_path, phone, phone_verified, discoverable, hide_phone';
export async function getMyProfile(userId: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select(profileCols).eq('id', userId).single());
}
export async function updateMyProfile(userId: string, v: Partial<Pick<Profile, 'display_name' | 'username' | 'bio' | 'avatar_path' | 'cover_path' | 'discoverable' | 'hide_phone'>>): Promise<Profile> {
  const patch: Record<string, unknown> = { ...v };
  if ('username' in v) patch.username = v.username?.trim().replace(/^@/, '').toLowerCase() || null;
  if ('display_name' in v) patch.display_name = v.display_name?.trim();
  if ('bio' in v) patch.bio = v.bio?.trim() || null;
  return unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select(profileCols).single());
}
export const getProfiles = (ids: string[]) => (ids.length ? rpc<PersonCard[]>('get_profiles', { p_ids: ids }) : Promise.resolve([]));
export const findUserByUsername = (u: string) => rpc<(PersonCard & { is_self: boolean })[]>('find_user_by_username', { p_username: u });
export const findUserByPhone = (phone: string) => rpc<(PersonCard & { is_self: boolean })[]>('find_user_by_phone', { p_phone: phone });
/** Prefix search by @username (up to 8 accounts). Finds anyone with a username, contact or not. */
export const searchUsers = (q: string) => rpc<UserHit[]>('search_users', { p_query: q });

// ───────── Chats ─────────
export const listChats = (businessId?: string | null) => rpc<Chat[]>('list_chats', { p_business: businessId ?? null, p_conv: null });
export async function getChat(id: string): Promise<Chat | null> {
  const rows = await rpc<Chat[]>('list_chats', { p_business: null, p_conv: id });
  return rows[0] ?? null;
}
export const startDirectChat = (userId: string) => rpc<string>('start_direct_chat', { p_other: userId });
/** A named incognito room with one person. It self-destructs after 3 h without messages, or at once when both ask. */
export const startIncognitoChat = (userId: string, title: string) => rpc<string>('start_incognito_chat', { p_other: userId, p_title: title });
/** Asks to destroy an incognito room now (or withdraws the request). Resolves `true` when the room is gone. */
export const requestIncognitoDestroy = (conv: string, cancel = false) => rpc<boolean>('request_incognito_destroy', { p_conv: conv, p_cancel: cancel });
export const INCOGNITO_TTL_MS = 3 * 3600e3;
export const createGroup = (title: string, members: string[]) => rpc<string>('create_group', { p_title: title, p_members: members });
export const leaveConversation = (id: string) => rpc<void>('leave_conversation', { p_conv: id });
export const markRead = (id: string) => rpc<void>('mark_read', { p_conv: id });
/** "It reached my device": called whenever messages are fetched or received, so the sender sees two ticks. */
export const markDelivered = (conv?: string | null) => rpc<number>('mark_delivered', { p_conv: conv ?? null });
export const updateBusinessConversation = (id: string, v: { state?: ConversationState; assigned?: string | null }) =>
  rpc<void>('update_business_conversation', { p_conv: id, p_state: v.state ?? null, p_assigned: v.assigned ?? null, p_unassign: v.assigned === null });

// ───────── Messages ─────────
const messageCols = 'id, conversation_id, sender_id, body, attachment_path, attachment_type, attachment_name, attachment_size, attachment_duration_ms, reply_to_id, edited_at, deleted_at, created_at, is_internal, is_automated';
export const PAGE = 40;
export async function fetchMessages(conversationId: string, before?: string): Promise<Message[]> {
  let q = supabase.from('messages').select(messageCols).eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(PAGE);
  if (before) q = q.lt('created_at', before);
  return unwrap<Message[]>(await q);
}
export type NewMessage = Pick<Message, 'id' | 'conversation_id' | 'sender_id'> & Partial<Pick<Message, 'body' | 'attachment_path' | 'attachment_type' | 'attachment_name' | 'attachment_size' | 'attachment_duration_ms' | 'reply_to_id' | 'is_internal'>>;
export async function sendMessage(m: NewMessage): Promise<Message> {
  const { data, error } = await supabase.from('messages').insert(m).select(messageCols).single();
  if (error) {
    // idempotent retry: the row may already exist from a previous attempt whose response was lost
    if (/duplicate key/i.test(error.message)) {
      const again = await supabase.from('messages').select(messageCols).eq('id', m.id).single();
      if (again.data) return again.data as Message;
    }
    throw new Error(friendly(error, 'No se pudo enviar el mensaje.'));
  }
  return data as Message;
}
export async function editMessage(id: string, body: string) { unwrap(await supabase.from('messages').update({ body }).eq('id', id).select('id').single()); }
export async function deleteMessage(id: string) { unwrap(await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id').single()); }

export async function fetchReactions(messageIds: string[]): Promise<Reaction[]> {
  if (!messageIds.length) return [];
  return unwrap<Reaction[]>(await supabase.from('message_reactions').select('message_id, user_id, emoji').in('message_id', messageIds));
}
export async function setReaction(messageId: string, userId: string, emoji: string | null) {
  if (!emoji) return unwrap(await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId));
  return unwrap(await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: userId, emoji }));
}
export type MemberReceipt = { user_id: string; last_read_at: string | null; last_delivered_at: string | null };
export async function fetchMemberReads(conversationId: string): Promise<MemberReceipt[]> {
  return unwrap(await supabase.from('conversation_members').select('user_id, last_read_at, last_delivered_at').eq('conversation_id', conversationId));
}

// ───────── Contacts & blocks ─────────
export async function listContacts(): Promise<ContactRow[]> {
  return unwrap(await supabase.from('contacts').select('id, display_name, phone, contact_user_id').order('display_name'));
}
export async function saveContact(ownerId: string, c: { display_name: string; phone: string | null; contact_user_id: string }) {
  return unwrap(await supabase.from('contacts').upsert({ owner_id: ownerId, ...c }, { onConflict: 'owner_id,contact_user_id', ignoreDuplicates: false }).select('id').single());
}
export const deleteContact = async (id: string) => unwrap(await supabase.from('contacts').delete().eq('id', id));
export async function listBlocked(): Promise<string[]> {
  return (unwrap<{ blocked_id: string }[]>(await supabase.from('user_blocks').select('blocked_id'))).map((r) => r.blocked_id);
}
export const blockUser = async (me: string, other: string) => unwrap(await supabase.from('user_blocks').upsert({ blocker_id: me, blocked_id: other }));
export const unblockUser = async (me: string, other: string) => unwrap(await supabase.from('user_blocks').delete().eq('blocker_id', me).eq('blocked_id', other));
/** Reports an unknown contact (or a business) that wrote to you. Only you can read your own reports. */
export const reportUser = async (me: string, r: { reported_id?: string | null; business_id?: string | null; conversation_id?: string | null; reason: string }) =>
  unwrap(await supabase.from('reports').insert({ reporter_id: me, reported_id: r.reported_id ?? null, business_id: r.business_id ?? null, conversation_id: r.conversation_id ?? null, reason: r.reason.trim().slice(0, 500) }));

// ───────── Statuses & business posts ─────────
const statusCols = 'id, user_id, kind, body, bg, media_path, created_at, expires_at, business_id';
/** Personal statuses of you and your contacts (24 h). */
export async function listStatuses(): Promise<StatusRow[]> {
  return unwrap(await supabase.from('statuses').select(statusCols).is('business_id', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true }));
}
/** Posts of the given businesses (up to 7 days): the feed of the businesses you follow / chat with, or one business page. */
export async function listBusinessPosts(businessIds: string[]): Promise<StatusRow[]> {
  if (!businessIds.length) return [];
  return unwrap(await supabase.from('statuses').select(statusCols).in('business_id', businessIds).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(200));
}
export const BUSINESS_POST_DAYS = 7;
export const postStatus = async (me: string, s: { kind: StatusKind; body?: string; bg?: number; media_path?: string; business_id?: string | null }) =>
  unwrap(await supabase.from('statuses').insert({ user_id: me, ...s, ...(s.business_id ? { expires_at: new Date(Date.now() + BUSINESS_POST_DAYS * 864e5).toISOString() } : {}) }));
export const deleteStatus = async (id: string) => unwrap(await supabase.from('statuses').delete().eq('id', id));

// ───────── Business ─────────
const businessCols = 'id, name, handle, description, category, email, phone, website, address, logo_path, cover_path, accent, greeting, away_message, away_enabled, is_public, owner_id, show_phone';
export async function myBusinesses(): Promise<BusinessMembership[]> {
  const rows = unwrap<{ role: BusinessRole; business: Business | Business[] }[]>(await supabase.from('business_members').select(`role, business:businesses(${businessCols})`));
  return rows.map((r) => ({ role: r.role, business: Array.isArray(r.business) ? r.business[0] : r.business })).filter((r) => r.business);
}
export const createBusiness = (v: { name: string; handle: string; category: string; description: string; phone: string }) =>
  rpc<string>('create_business', { p_name: v.name, p_handle: v.handle, p_category: v.category, p_description: v.description, p_phone: v.phone });
export async function updateBusiness(id: string, patch: Partial<Omit<Business, 'id' | 'owner_id'>>) {
  return unwrap<Business>(await supabase.from('businesses').update(patch).eq('id', id).select(businessCols).single());
}
export const listTeam = (businessId: string) => rpc<TeamMember[]>('list_business_team', { p_business: businessId });
export const addTeamMember = (businessId: string, phone: string, role: BusinessRole) => rpc<string>('add_business_member', { p_business: businessId, p_phone: phone, p_role: role });
export const setTeamRole = (businessId: string, userId: string, role: BusinessRole) => rpc<void>('set_business_member_role', { p_business: businessId, p_user: userId, p_role: role });
export const removeTeamMember = (businessId: string, userId: string) => rpc<void>('remove_business_member', { p_business: businessId, p_user: userId });

export async function listQuickReplies(businessId: string): Promise<QuickReply[]> {
  return unwrap(await supabase.from('quick_replies').select('id, business_id, shortcut, body').eq('business_id', businessId).order('shortcut'));
}
export const addQuickReply = async (businessId: string, shortcut: string, body: string) => unwrap(await supabase.from('quick_replies').insert({ business_id: businessId, shortcut, body }));
export const deleteQuickReply = async (id: string) => unwrap(await supabase.from('quick_replies').delete().eq('id', id));

const catalogCols = 'id, business_id, name, description, price_minor, currency, image_path, is_published';
export async function listCatalog(businessId: string): Promise<CatalogItem[]> {
  return unwrap(await supabase.from('catalog_items').select(catalogCols).eq('business_id', businessId).order('created_at', { ascending: false }));
}
export async function saveCatalogItem(item: Partial<CatalogItem> & { business_id: string; name: string }) {
  return unwrap(await supabase.from('catalog_items').upsert(item).select(catalogCols).single());
}
export const deleteCatalogItem = async (id: string) => unwrap(await supabase.from('catalog_items').delete().eq('id', id));

export type PublicBusiness = Pick<Business, 'id' | 'name' | 'handle' | 'category' | 'description' | 'phone' | 'email' | 'website' | 'address' | 'logo_path'> & { cover_path?: string | null; accent?: BizAccent | null; show_phone?: boolean; catalog: Pick<CatalogItem, 'id' | 'name' | 'description' | 'price_minor' | 'currency' | 'image_path'>[] };
export const searchBusinesses = (q: string) => rpc<Pick<Business, 'id' | 'name' | 'handle' | 'category' | 'description' | 'logo_path'>[]>('search_businesses', { p_query: q });
export const getPublicBusiness = (id: string) => rpc<PublicBusiness | null>('get_business_public', { p_id: id });
export const startBusinessChat = (businessId: string) => rpc<string>('start_business_chat', { p_business: businessId });

// ───────── Chat organization ─────────
export const setChatFlags = (conv: string, f: { pinned?: boolean; archived?: boolean; unread?: boolean; mutedUntil?: string | null; unmute?: boolean }) =>
  rpc<void>('set_chat_flags', { p_conv: conv, p_pinned: f.pinned ?? null, p_archived: f.archived ?? null, p_unread: f.unread ?? null, p_muted_until: f.mutedUntil ?? null, p_unmute: !!f.unmute });

// ───────── Search, starred, scheduled ─────────
export type SearchHit = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
export const searchMessages = (q: string) => rpc<SearchHit[]>('search_messages', { p_query: q, p_limit: 40 });

export type StarredRow = { created_at: string; message: Message };
export async function listStarred(): Promise<StarredRow[]> {
  const rows = unwrap<{ created_at: string; message: Message | Message[] }[]>(await supabase.from('starred_messages').select(`created_at, message:messages(${messageCols})`).order('created_at', { ascending: false }));
  return rows.map((r) => ({ created_at: r.created_at, message: Array.isArray(r.message) ? r.message[0] : r.message })).filter((r) => r.message && !r.message.deleted_at);
}
export async function starredIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  return unwrap<{ message_id: string }[]>(await supabase.from('starred_messages').select('message_id').in('message_id', ids)).map((r) => r.message_id);
}
export const starMessage = async (me: string, id: string, on: boolean) => on
  ? unwrap(await supabase.from('starred_messages').upsert({ user_id: me, message_id: id }))
  : unwrap(await supabase.from('starred_messages').delete().eq('user_id', me).eq('message_id', id));

export type ScheduledRow = { id: string; conversation_id: string; body: string; send_at: string; is_internal: boolean; reply_to_id: string | null };
export const scheduleMessage = async (me: string, m: { conversation_id: string; body: string; send_at: string; is_internal?: boolean; reply_to_id?: string | null }) =>
  unwrap(await supabase.from('scheduled_messages').insert({ sender_id: me, ...m }));
export async function listScheduled(conversationId?: string): Promise<ScheduledRow[]> {
  let q = supabase.from('scheduled_messages').select('id, conversation_id, body, send_at, is_internal, reply_to_id').order('send_at');
  if (conversationId) q = q.eq('conversation_id', conversationId);
  return unwrap(await q);
}
export const cancelScheduled = async (id: string) => unwrap(await supabase.from('scheduled_messages').delete().eq('id', id));

// ───────── Call log (calls are recorded as messages by the caller) ─────────
export async function listCallMessages(): Promise<Message[]> {
  return unwrap<Message[]>(await supabase.from('messages').select(messageCols).or('body.like.📞%,body.like.📹%').is('deleted_at', null).order('created_at', { ascending: false }).limit(100));
}
export async function countMissedCalls(me: string, since: string): Promise<number> {
  const { count, error } = await supabase.from('messages').select('id', { count: 'exact', head: true }).ilike('body', '%sin respuesta').neq('sender_id', me).gt('created_at', since);
  if (error) return 0;
  return count ?? 0;
}
