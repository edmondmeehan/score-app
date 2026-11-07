import type { SupabaseClient } from '@supabase/supabase-js';

/** Signed URLs (1 hour) for each user's photos, ordered by position. */
export async function photoUrls(supabase: SupabaseClient, userIds: string[], onlyApproved = true) {
  const out: Record<string, string[]> = {};
  if (!userIds.length) return out;
  let q = supabase.from('photos').select('user_id, path, position, match_status').in('user_id', userIds).order('position');
  if (onlyApproved) q = q.eq('match_status', 'approved');
  const { data } = await q;
  if (!data?.length) return out;
  // Demo accounts point at generated images on the Higgsfield CDN; everything else is a private Storage path.
  const stored = data.filter((p) => !isDemoUrl(p.path));
  const { data: signed } = stored.length ? await supabase.storage.from('photos').createSignedUrls(stored.map((p) => p.path), 3600) : { data: [] };
  const byPath = new Map(stored.map((p, i) => [p.path, signed?.[i]?.signedUrl]));
  data.forEach((p) => {
    const url = isDemoUrl(p.path) ? p.path : byPath.get(p.path);
    if (url) (out[p.user_id] ||= []).push(url);
  });
  return out;
}

/** Only Higgsfield CDN images are ever shown from a URL, so a member can't point a photo row at an arbitrary site. */
export function isDemoUrl(path: string) {
  return /^https:\/\/(d8j0ntlcm91z4\.cloudfront\.net|[a-z0-9-]+\.higgsfield\.ai|cdn\.higgsfield\.ai)\//.test(path);
}
