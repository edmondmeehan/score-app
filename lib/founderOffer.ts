import type { SupabaseClient } from '@supabase/supabase-js';

export type FounderOffer = { enabled: boolean; intro: string; monthly: string; regular: string; offering: string };
export const FOUNDER_OFFER_DEFAULT: FounderOffer = { enabled: false, intro: 'First month free', monthly: '$19.99/mo', regular: '$24.99/mo', offering: 'founders' };

/** The Founding Member price offer. Only shown when staff turn it on, after it exists in App Store Connect / RevenueCat. */
export async function getFounderOffer(sb: SupabaseClient): Promise<FounderOffer> {
  const { data } = await sb.from('app_config').select('value').eq('key', 'founder_offer').maybeSingle();
  return { ...FOUNDER_OFFER_DEFAULT, ...((data?.value as Partial<FounderOffer>) || {}) };
}
