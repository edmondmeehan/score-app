'use server';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Owners only: remove a member's two-step sign-in (lost phone). They sign in with their password and can set it up again. */
export async function resetTwoStep(form: FormData) {
  const { staffRole } = await requireStaff();
  const id = String(form.get('id') || '');
  const back = `/admin/members/${id}`;
  if (staffRole !== 'owner' || !/^[0-9a-f-]{36}$/i.test(id)) redirect(back);
  const admin = supabaseAdmin();
  if (!admin) redirect(`${back}?tfa=nokey`);
  const { data } = await admin.auth.admin.mfa.listFactors({ userId: id });
  for (const f of data?.factors || []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: id });
  redirect(`${back}?tfa=reset`);
}
