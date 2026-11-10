import type { SupabaseClient } from '@supabase/supabase-js';

// Reuse a signed link for ~45 minutes (links last 2 hours). The same photo keeps the same address, so phones and
// browsers can keep it cached instead of downloading it again on every page. Only paths this viewer is allowed to read
// (the photos query above runs under their privacy rules) ever get looked up here.
const SIGN_FOR = 7200;
const REUSE_MS = 45 * 60 * 1000;
const signedCache = new Map<string, { url: string; at: number }>();
async function signPaths(supabase: SupabaseClient, paths: string[]) {
  const now = Date.now();
  const out = new Map<string, string>();
  const need: string[] = [];
  for (const p of paths) {
    const hit = signedCache.get(p);
    if (hit && now - hit.at < REUSE_MS) out.set(p, hit.url); else need.push(p);
  }
  if (need.length) {
    const { data } = await supabase.storage.from('photos').createSignedUrls(need, SIGN_FOR);
    need.forEach((p, i) => { const url = data?.[i]?.signedUrl; if (url) { out.set(p, url); signedCache.set(p, { url, at: now }); } });
    if (signedCache.size > 5000) for (const [k, v] of signedCache) if (now - v.at >= REUSE_MS) signedCache.delete(k);
  }
  return out;
}

/** Signed URLs for each user's photos, ordered by position. */
export async function photoUrls(supabase: SupabaseClient, userIds: string[], onlyApproved = true) {
  const out: Record<string, string[]> = {};
  if (!userIds.length) return out;
  let q = supabase.from('photos').select('user_id, path, position, match_status').in('user_id', userIds).order('position');
  if (onlyApproved) q = q.eq('match_status', 'approved');
  const { data } = await q;
  if (!data?.length) return out;
  // Demo accounts point at generated images on the Higgsfield CDN; everything else is a private Storage path.
  const stored = data.filter((p) => !isDemoUrl(p.path));
  const byPath = stored.length ? await signPaths(supabase, stored.map((p) => p.path)) : new Map<string, string>();
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
