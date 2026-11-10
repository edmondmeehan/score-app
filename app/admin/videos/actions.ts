'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';

export async function reviewVideo(form: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('staff_review_video', { p_user: String(form.get('user')), p_ok: form.get('ok') === '1', p_note: String(form.get('note') || '') || null });
  revalidatePath('/admin/videos');
  redirect('/admin/videos' + (error ? '?error=' + encodeURIComponent(error.message) : '?ok=Saved'));
}
