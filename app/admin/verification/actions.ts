'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireStaff } from '@/lib/session';

/** Flip between self-reported bands and partner-verified bands. Takes effect site-wide right away. */
export async function setCreditMode(form: FormData) {
  const { supabase } = await requireStaff();
  const mode = form.get('mode') === 'self' ? 'self' : 'verified';
  const { error } = await supabase.rpc('staff_set_credit_mode', { p_mode: mode });
  if (error) redirect('/admin/verification?error=' + encodeURIComponent(error.message));
  revalidateTag('credit-mode');
  revalidatePath('/', 'layout');
  redirect('/admin/verification?ok=' + encodeURIComponent(mode === 'self' ? 'Self-reported bands are on.' : 'Partner verification is on.'));
}
