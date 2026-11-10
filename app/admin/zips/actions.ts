'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export async function toggleMetroZip(form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('staff_set_metro_zip', { p_zip: String(form.get('zip')), p_active: form.get('active') === '1' });
  revalidatePath('/admin/zips');
  redirect('/admin/zips' + (error ? '?error=' + encodeURIComponent(error.message) : ''));
}
