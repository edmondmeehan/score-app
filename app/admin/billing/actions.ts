'use server';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';

/** Owners: turn Founding Lifetime on/off, set how many can be sold and the price shown. */
export async function saveLifetimeOffer(form: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('staff_set_lifetime_offer', {
    p_enabled: form.get('enabled') === 'on', p_cap: Number(form.get('cap') || 100), p_early_cap: Number(form.get('early_cap') || 0),
    p_price: String(form.get('price') || '$499'), p_price2: String(form.get('price2') || '$749'),
  });
  redirect(`/admin/billing?${error ? `error=${encodeURIComponent(error.message)}` : 'saved=1'}#lifetime`);
}
