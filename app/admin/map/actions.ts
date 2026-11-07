'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';

export async function setPublicMapDemo(form: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('staff_set_public_map_demo', { p_on: form.get('on') === 'true' });
  revalidatePath('/');   // refresh the home page map right away
  redirect('/admin/map' + (error ? '?error=' + encodeURIComponent(error.message) : ''));
}
