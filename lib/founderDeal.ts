import { unstable_cache } from 'next/cache';
import { supabaseAnon } from '@/lib/supabase/server';

/** The Founding Member offer (Admin config 'founder_deal', migration 0083), for public pages. */
export type FounderDeal = { enabled: boolean; months: number; price: string };

export const getFounderDeal = unstable_cache(async (): Promise<FounderDeal> => {
  try {
    const { data } = await supabaseAnon().from('app_config').select('value').eq('key', 'founder_deal').maybeSingle();
    const v = (data?.value || {}) as { enabled?: boolean; free_months?: number; price?: string };
    return { enabled: v.enabled !== false, months: Number(v.free_months) || 6, price: v.price || '$9.99' };
  } catch {
    return { enabled: true, months: 6, price: '$9.99' };
  }
}, ['founder-deal'], { tags: ['founder-deal'], revalidate: 300 });

/** One line used across the site, emails and cards so the offer is always described the same way. */
export const founderOfferLine = (d: FounderDeal) =>
  `Up to ${d.months} months of Membership free, then a Founding rate of ${d.price}/month, locked in for as long as you stay subscribed.`;
