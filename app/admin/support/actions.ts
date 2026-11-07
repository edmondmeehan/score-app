'use server';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';

export async function updateTicket(form: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('staff_update_ticket', {
    p_id: String(form.get('id')), p_status: String(form.get('status')), p_note: String(form.get('note') || ''),
  });
  redirect('/admin/support' + (error ? '?error=' + encodeURIComponent(error.message) : ''));
}
