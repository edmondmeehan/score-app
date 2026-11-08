import type { SupabaseClient } from '@supabase/supabase-js';

/** ids → whether that member's band was verified by the credit partner (vs self-reported). */
export async function verifiedMap(supabase: SupabaseClient, ids: string[]): Promise<Record<string, boolean>> {
  if (!ids.length) return {};
  const { data } = await supabase.from('profiles').select('id, credit_verified_at').in('id', ids);
  return Object.fromEntries(((data as { id: string; credit_verified_at: string | null }[]) || []).map((r) => [r.id, Boolean(r.credit_verified_at)]));
}
