import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Should members see their waitlist number yet? (Admin → Waitlist & invites; migration 0087.) Hidden if anything goes wrong. */
export async function showWaitlistPosition(sb: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc('waitlist_show_position');
    return !error && data === true;
  } catch {
    return false;
  }
}
