import type { SupabaseClient } from '@supabase/supabase-js';

/** Is the Reserve tier offered to new members? Toggle in Admin → Reserve. Defaults to hidden. */
export async function getReserveVisible(sb: SupabaseClient): Promise<boolean> {
  const { data } = await sb.from('app_config').select('value').eq('key', 'reserve_visible').maybeSingle();
  return data?.value === true;
}

export type MyMatchmaker = { assigned: boolean; name: string | null; photo_url: string | null; bio: string | null; booking_url: string | null; contact_email: string; unread: number };
