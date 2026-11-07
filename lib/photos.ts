import type { SupabaseClient } from '@supabase/supabase-js';

/** Signed URLs (1 hour) for each user's photos, ordered by position. */
export async function photoUrls(supabase: SupabaseClient, userIds: string[], onlyApproved = true) {
  const out: Record<string, string[]> = {};
  if (!userIds.length) return out;
  let q = supabase.from('photos').select('user_id, path, position, match_status').in('user_id', userIds).order('position');
  if (onlyApproved) q = q.eq('match_status', 'approved');
  const { data } = await q;
  if (!data?.length) return out;
  const { data: signed } = await supabase.storage.from('photos').createSignedUrls(data.map((p) => p.path), 3600);
  data.forEach((p, i) => {
    const url = signed?.[i]?.signedUrl;
    if (url) (out[p.user_id] ||= []).push(url);
  });
  return out;
}
