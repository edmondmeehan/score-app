'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireStaff } from '@/lib/session';
import { contactFor, sendEmail } from '@/lib/mailer';
import { reasonFor } from '@/lib/verifyReview';

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

/** Record a decision on a member's ID or photos, with an optional note to the member. */
export async function decideVerification(form: FormData) {
  const { supabase } = await requireStaff();
  const user = String(form.get('user'));
  const kind = form.get('kind') === 'photos' ? 'photos' : 'id';
  const decision = String(form.get('decision'));
  const back = `/admin/verification/${user}`;
  if (!['approved', 'retry', 'note'].includes(decision)) redirect(back + '?error=' + encodeURIComponent('Pick a decision.'));
  const code = String(form.get('reason') || '');
  const typed = String(form.get('message') || '').trim();
  const message = decision === 'retry' ? typed || reasonFor(kind, code).message : typed;
  const { error } = await supabase.rpc('staff_verification_decide', {
    p_user: user, p_kind: kind, p_decision: decision, p_reason_code: decision === 'retry' ? code : '', p_note: String(form.get('note') || ''), p_member_message: decision === 'note' ? '' : message,
  });
  if (error) redirect(back + '?error=' + encodeURIComponent(error.message));
  let emailed = false;
  if (form.get('notify') === 'on' && decision !== 'note') {
    const c = await contactFor(user);
    if (c.email) {
      if (decision === 'approved') await sendEmail(c.email, kind === 'id' ? 'id_approved' : 'photos_review', { first_name: c.first_name, approved: true });
      else await sendEmail(c.email, 'verification_feedback', { first_name: c.first_name, kind, message });
      emailed = true;
    }
  }
  revalidatePath('/admin/verification');
  const label = decision === 'note' ? 'Note saved.' : `${kind === 'id' ? 'ID' : 'Photos'} ${decision === 'approved' ? 'approved' : 'sent back for a redo'}${emailed ? ' and the member was emailed' : ''}.`;
  redirect(back + '?ok=' + encodeURIComponent(label));
}

/** Approve or reject a single photo. */
export async function setPhoto(form: FormData) {
  const { supabase } = await requireStaff();
  const user = String(form.get('user'));
  const { error } = await supabase.rpc('staff_set_photo', { p_photo: String(form.get('photo')), p_status: form.get('status') === 'approved' ? 'approved' : 'rejected' });
  revalidatePath('/admin/verification');
  redirect(`/admin/verification/${user}?` + (error ? 'error=' + encodeURIComponent(error.message) : 'ok=' + encodeURIComponent('Photo updated.')));
}
