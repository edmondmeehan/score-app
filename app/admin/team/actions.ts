'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';
import { sendEmail } from '@/lib/mailer';
import { SITE_URL } from '@/lib/emails';

const back = (q: string) => redirect('/admin/team?' + q);

async function welcome(supabase: Awaited<ReturnType<typeof requireStaff>>['supabase'], staffEmail: string, name: string, email: string) {
  const { data: list } = await supabase.rpc('staff_list');
  const row = ((list as { email: string; has_account: boolean }[]) || []).find((r) => r.email.toLowerCase() === email.toLowerCase());
  const hasAccount = Boolean(row?.has_account);
  const { data: me } = await supabase.from('staff').select('name').eq('email', staffEmail).maybeSingle();
  const url = `${SITE_URL}/signin?mode=${hasAccount ? 'signin' : 'signup'}&next=${encodeURIComponent('/admin')}&email=${encodeURIComponent(email)}`;
  const r = await sendEmail(email, 'staff_welcome', { name, added_by: (me as { name?: string } | null)?.name || null, url, has_account: hasAccount });
  if (r.ok) await supabase.rpc('staff_mark_welcomed', { p_email: email });
  return r;
}

export async function addAdmin(form: FormData) {
  const { supabase, staffEmail } = await requireStaff();
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const { data: added, error } = await supabase.rpc('staff_add', { p_name: name, p_email: email });
  if (error) back('error=' + encodeURIComponent(error.message));
  if (!added) back('error=' + encodeURIComponent(`${email} is already an admin.`));
  const r = await welcome(supabase, staffEmail, name, email);
  revalidatePath('/admin/team');
  back(r.ok ? 'ok=' + encodeURIComponent(`Added ${name}. Welcome email sent to ${email}.`) : 'error=' + encodeURIComponent(`Added ${name}, but the welcome email didn’t send: ${r.error}`));
}

export async function resendWelcome(form: FormData) {
  const { supabase, staffEmail } = await requireStaff();
  const { data: isOwner } = await supabase.rpc('is_owner');
  if (!isOwner) back('error=' + encodeURIComponent('Only owners can do that.'));
  const email = String(form.get('email') || '');
  const name = String(form.get('name') || '');
  const r = await welcome(supabase, staffEmail, name, email);
  revalidatePath('/admin/team');
  back(r.ok ? 'ok=' + encodeURIComponent(`Welcome email re-sent to ${email}.`) : 'error=' + encodeURIComponent(r.error || 'Couldn’t send'));
}

export async function removeAdmin(form: FormData) {
  const { supabase } = await requireStaff();
  const email = String(form.get('email') || '');
  const { error } = await supabase.rpc('staff_remove', { p_email: email });
  if (error) back('error=' + encodeURIComponent(error.message));
  revalidatePath('/admin/team');
  back('ok=' + encodeURIComponent(`Removed ${email}. They no longer have admin access.`));
}
