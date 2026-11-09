'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export async function enterWeb(form: FormData) {
  const id = String(form.get('id') || '');
  if (String(form.get('website_confirm') || '')) redirect(`/giveaways/${id}?entered=1`); // bots
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('enter_giveaway_web', {
    p_g: id, p_email: String(form.get('email') || ''), p_first: String(form.get('first') || ''),
    p_zip: String(form.get('zip') || '').trim(), p_age_ok: form.get('age') === 'on',
  });
  if (error) redirect(`/giveaways/${id}?error=` + encodeURIComponent(error.message));
  redirect(`/giveaways/${id}?entered=1`);
}
