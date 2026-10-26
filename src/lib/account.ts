import { rpc } from './api';
import { supabase } from './supabase';

/** Best effort: remove the files this person uploaded (photos, videos, voice notes, status media) before the account goes. */
export async function purgeMyFiles(userId: string): Promise<void> {
  const remove = async (bucket: 'avatars' | 'chat-media', paths: string[]) => {
    for (let i = 0; i < paths.length; i += 100) await supabase.storage.from(bucket).remove(paths.slice(i, i + 100)).catch(() => {});
  };
  try {
    const own = await supabase.storage.from('avatars').list(userId, { limit: 200 });
    await remove('avatars', (own.data ?? []).map((f) => `${userId}/${f.name}`));
    const files: string[] = [];
    for (let from = 0; from < 5000; from += 1000) {
      const { data } = await supabase.from('messages').select('attachment_path').eq('sender_id', userId).not('attachment_path', 'is', null).range(from, from + 999);
      (data ?? []).forEach((r: { attachment_path: string | null }) => r.attachment_path && files.push(r.attachment_path));
      if (!data || data.length < 1000) break;
    }
    const { data: st } = await supabase.from('statuses').select('media_path').eq('user_id', userId).not('media_path', 'is', null);
    (st ?? []).forEach((r: { media_path: string | null }) => r.media_path && files.push(r.media_path));
    await remove('chat-media', files);
  } catch { /* the account is deleted even if some files could not be listed */ }
}

export const deleteMyAccount = () => rpc<void>('delete_my_account');
