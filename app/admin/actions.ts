'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { contactFor, sendBatch, sendEmail } from '@/lib/mailer';

export async function staffAct(form: FormData) {
  const supabase = await supabaseServer();
  const back = String(form.get('back') || '/admin');
  const { error } = await supabase.rpc('staff_act', {
    p_action: String(form.get('action')),
    p_user: String(form.get('user')),
    p_reason: String(form.get('reason') || ''),
    p_report: form.get('report') ? String(form.get('report')) : null,
  });
  if (error) redirect(back + (back.includes('?') ? '&' : '?') + 'error=' + encodeURIComponent(error.message));
  const action = String(form.get('action'));
  if (['approve_photos', 'reject_photos', 'approve_id', 'decline_id'].includes(action)) {
    const c = await contactFor(String(form.get('user')));
    if (action.endsWith('photos')) await sendEmail(c.email, 'photos_review', { first_name: c.first_name, approved: action === 'approve_photos' });
    else await sendEmail(c.email, action === 'approve_id' ? 'id_approved' : 'id_needs_attention', { first_name: c.first_name });
  }
  revalidatePath(back);
  redirect(back);
}

export async function createInvites(form: FormData) {
  const supabase = await supabaseServer();
  const n = Math.max(1, Math.min(500, Number(form.get('count') || 1)));
  const { data, error } = await supabase.rpc('staff_create_invites', { p_count: n, p_kind: String(form.get('kind') || 'drop') });
  if (error) redirect('/admin/waitlist?error=' + encodeURIComponent(error.message));
  redirect('/admin/waitlist?codes=' + encodeURIComponent((data as string[]).join(',')));
}

export async function setZip(form: FormData) {
  const supabase = await supabaseServer();
  const zip = String(form.get('zip') || '').trim();
  if (!/^[0-9]{5}$/.test(zip)) redirect('/admin/waitlist?error=' + encodeURIComponent('Enter a 5-digit zip code.'));
  const { error } = await supabase.rpc('staff_set_zip', {
    p_zip: zip,
    p_borough: String(form.get('borough') || 'Manhattan'),
    p_active: form.get('active') === 'on',
  });
  if (error) redirect('/admin/waitlist?error=' + encodeURIComponent(error.message));
  redirect('/admin/waitlist?zip_saved=' + zip);
}

export async function emailInvite(form: FormData) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('staff_invite_waitlist', { p_id: String(form.get('id')) });
  if (error) redirect('/admin/waitlist?error=' + encodeURIComponent(error.message));
  const r = data as { code: string; email: string; first_name: string; days: number };
  const sent = await sendEmail(r.email, 'invite', { first_name: r.first_name, code: r.code, days: r.days, inviter: null });
  redirect('/admin/waitlist?' + (sent.ok ? 'invited=' + encodeURIComponent(`Invite emailed to ${r.email}.`) : 'error=' + encodeURIComponent(`Code ${r.code} created, but the email didn't send: ${sent.error}`)));
}

export async function inviteBatch(form: FormData) {
  const supabase = await supabaseServer();
  const area = String(form.get('area') || '');
  const zips = String(form.get('zips') || '').split(/[\s,]+/).map((z) => z.trim()).filter((z) => /^[0-9]{5}$/.test(z));
  const n = Math.max(1, Math.min(500, Number(form.get('count') || 0)));
  const { data, error } = await supabase.rpc('staff_invite_batch', { p_area: area || null, p_zips: zips.length ? zips : null, p_limit: n });
  if (error) redirect('/admin/waitlist?error=' + encodeURIComponent(error.message));
  const rows = (data || []) as { code: string; email: string; first_name: string | null; days: number }[];
  if (!rows.length) redirect('/admin/waitlist?error=' + encodeURIComponent('Nobody waiting matches that area or zip.'));
  const r = await sendBatch('invite', rows.map((x) => ({ to: x.email, data: { first_name: x.first_name, code: x.code, days: x.days, inviter: null } })));
  const msg = `Invited ${rows.length}${area ? ` in ${area}` : ''}${zips.length ? ` (${zips.join(', ')})` : ''}. Emails sent: ${r.sent}.` + (r.failed ? ` ${r.failed} didn't send: ${r.error}. They're marked invited and their codes are saved on the waitlist, so you can send them again.` : '');
  redirect('/admin/waitlist?' + (r.failed ? 'error=' : 'invited=') + encodeURIComponent(msg));
}

export async function setAreaStatus(form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('staff_set_area', { p_name: String(form.get('name')), p_status: String(form.get('status')), p_sort: null });
  if (error) redirect('/admin/waitlist?error=' + encodeURIComponent(error.message));
  redirect('/admin/waitlist');
}

export async function setPrefix(form: FormData) {
  const supabase = await supabaseServer();
  const prefix = String(form.get('prefix') || '').trim();
  const area = String(form.get('area') || '').trim();
  if (!/^[0-9]{3}$/.test(prefix) || !area) redirect('/admin/waitlist?error=' + encodeURIComponent('Enter the first 3 digits of the zip and an area name.'));
  const { error } = await supabase.rpc('staff_set_prefix', { p_prefix: prefix, p_area: area });
  if (error) redirect('/admin/waitlist?error=' + encodeURIComponent(error.message));
  redirect('/admin/waitlist?invited=' + encodeURIComponent(`Zips starting ${prefix} now count as ${area}.`));
}

export async function resendInvite(form: FormData) {
  const supabase = await supabaseServer();
  const { data: w } = await supabase.from('waitlist').select('email, first_name, invite_code').eq('id', String(form.get('id'))).single();
  if (!w?.invite_code) redirect('/admin/waitlist?error=' + encodeURIComponent('No saved code for that person.'));
  const r = await sendEmail(w.email, 'invite', { first_name: w.first_name || null, code: w.invite_code, days: 14, inviter: null });
  redirect('/admin/waitlist?' + (r.ok ? 'invited=' + encodeURIComponent(`Invite re-sent to ${w.email}.`) : 'error=' + encodeURIComponent(r.error || 'failed')));
}

export async function toggleFounder(form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('staff_set_founder', { p_waitlist: String(form.get('id')), p_on: form.get('on') === 'true' });
  redirect('/admin/waitlist' + (error ? '?error=' + encodeURIComponent(error.message) : ''));
}

export async function saveFounderOffer(form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('staff_set_founder_offer', {
    p_enabled: form.get('enabled') === 'on', p_intro: String(form.get('intro') || ''), p_monthly: String(form.get('monthly') || ''),
  });
  redirect('/admin/waitlist' + (error ? '?error=' + encodeURIComponent(error.message) : ''));
}
