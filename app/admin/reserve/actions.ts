'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';

const err = (m: string) => (/function|does not exist|schema cache|relation/i.test(m) ? 'Run migration 0022 in the Score SQL Editor first.' : m);
const back = (path: string, q: string) => redirect(`${path}${path.includes('?') ? '&' : '?'}${q}`);

export async function setReserveVisible(form: FormData) {
  const { supabase } = await requireStaff();
  const on = form.get('on') === 'true';
  const { error } = await supabase.rpc('staff_set_reserve_visible', { p_on: on });
  if (error) back('/admin/reserve', 'error=' + encodeURIComponent(err(error.message)));
  revalidatePath('/', 'layout');
  back('/admin/reserve', 'ok=' + encodeURIComponent(on ? 'Reserve is now offered to members.' : 'Reserve is hidden. Current Reserve members keep it.'));
}

export async function saveMatchmaker(form: FormData) {
  const { supabase } = await requireStaff();
  const s = (k: string) => String(form.get(k) || '').trim();
  const booking = s('booking_url');
  if (booking && !/^https:\/\//.test(booking)) back('/admin/reserve', 'error=' + encodeURIComponent('Booking link must start with https://') + '#matchmakers');
  const photo = s('photo_url');
  if (photo && !/^https:\/\//.test(photo)) back('/admin/reserve', 'error=' + encodeURIComponent('Photo link must start with https://') + '#matchmakers');
  const { error } = await supabase.rpc('staff_save_matchmaker', {
    p_id: s('id') || null, p_name: s('name'), p_staff_email: s('staff_email'), p_photo_url: photo, p_bio: s('bio'),
    p_booking_url: booking, p_contact_email: s('contact_email'), p_active: form.get('active') === 'on',
  });
  if (error) back('/admin/reserve', 'error=' + encodeURIComponent(err(error.message)) + '#matchmakers');
  revalidatePath('/admin/reserve');
  back('/admin/reserve', 'ok=' + encodeURIComponent('Matchmaker saved.') + '#matchmakers');
}

export async function assignMatchmaker(form: FormData) {
  const { supabase } = await requireStaff();
  const member = String(form.get('member'));
  const mm = String(form.get('matchmaker') || '');
  const from = String(form.get('from') || '/admin/reserve');
  const { error } = await supabase.rpc('staff_assign_matchmaker', { p_member: member, p_matchmaker: mm || null });
  if (error) back(from, 'error=' + encodeURIComponent(err(error.message)));
  revalidatePath('/admin/reserve');
  back(from.startsWith('/admin/') ? from : '/admin/reserve', 'ok=' + encodeURIComponent(mm ? 'Matchmaker assigned.' : 'Matchmaker removed.'));
}

export async function replyAsMatchmaker(form: FormData) {
  const { supabase } = await requireStaff();
  const member = String(form.get('member'));
  const { error } = await supabase.rpc('staff_matchmaker_reply', { p_member: member, p_body: String(form.get('body') || '') });
  if (error) back(`/admin/reserve/${member}`, 'error=' + encodeURIComponent(err(error.message)));
  revalidatePath(`/admin/reserve/${member}`);
  redirect(`/admin/reserve/${member}#thread`);
}

export async function addMatchmakerNote(form: FormData) {
  const { supabase } = await requireStaff();
  const member = String(form.get('member'));
  const { error } = await supabase.rpc('staff_matchmaker_note', { p_member: member, p_body: String(form.get('body') || '') });
  if (error) back(`/admin/reserve/${member}`, 'error=' + encodeURIComponent(err(error.message)));
  revalidatePath(`/admin/reserve/${member}`);
  redirect(`/admin/reserve/${member}#notes`);
}
