'use server';
import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session';
import { syncFromStore } from '@/lib/billingSync';
import { contactFor, sendEmail } from '@/lib/mailer';

/** Called by the app right after an App Store purchase or "Restore purchases". */
export async function syncPurchases(kind: 'plan' | 'addon' | 'restore'): Promise<{ plan: string; addons: number; error?: string }> {
  const { user, me } = await getMe();
  if (!user) return { plan: 'none', addons: 0, error: 'Sign in first' };
  const before = me?.plan;
  const r = await syncFromStore(user.id);
  if (kind === 'plan' && ['membership', 'premium', 'black'].includes(r.plan) && before !== r.plan) {
    const c = await contactFor(user.id);
    const label: Record<string, string> = { membership: 'Membership', premium: 'Premium', black: 'Reserve' };
    await sendEmail(c.email, 'welcome_member', { first_name: c.first_name, plan: label[r.plan], drop_size: r.plan === 'membership' ? 5 : 10 }).catch(() => null);
  }
  revalidatePath('/app', 'layout');
  revalidatePath('/plans');
  return r;
}
