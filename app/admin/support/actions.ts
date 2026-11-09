'use server';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';

export async function updateTicket(form: FormData) {
  const { supabase } = await requireStaff();
  // Pressing Enter in the note field submits without a button, so keep the ticket's current status.
  const allowed = ['open', 'pending', 'resolved'];
  const picked = String(form.get('status') || '');
  const status = allowed.includes(picked) ? picked : allowed.includes(String(form.get('current'))) ? String(form.get('current')) : 'open';
  const { error } = await supabase.rpc('staff_update_ticket', {
    p_id: String(form.get('id')), p_status: status, p_note: String(form.get('note') || ''),
  });
  redirect('/admin/support' + (error ? '?error=' + encodeURIComponent(error.message) : ''));
}

/** One action per button (bound status), so the chosen status never depends on which button the browser reports as the submitter. */
export async function setTicketStatus(status: 'open' | 'pending' | 'resolved' | 'keep', form: FormData) {
  const { supabase } = await requireStaff();
  const allowed = ['open', 'pending', 'resolved'];
  const current = String(form.get('current') || 'open');
  const next = status === 'keep' ? (allowed.includes(current) ? current : 'open') : status;
  const { error } = await supabase.rpc('staff_update_ticket', {
    p_id: String(form.get('id')), p_status: next, p_note: String(form.get('note') || ''),
  });
  redirect('/admin/support' + (error ? '?error=' + encodeURIComponent(error.message) : next === 'resolved' ? '?ok=resolved' : ''));
}
