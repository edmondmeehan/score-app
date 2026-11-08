'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export async function messageMatchmaker(form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('send_matchmaker_message', { p_body: String(form.get('body') || '') });
  if (error) redirect('/app/matchmaker?error=' + encodeURIComponent(error.message));
  revalidatePath('/app/matchmaker');
  redirect('/app/matchmaker?sent=1#thread');
}
