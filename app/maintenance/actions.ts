'use server';
import { redirect } from 'next/navigation';
import { supabaseAnon } from '@/lib/supabase/server';

export async function sendContact(form: FormData) {
  if (String(form.get('website') || '')) redirect('/maintenance?sent=1'); // spam trap
  const { error } = await supabaseAnon().rpc('submit_contact', {
    p_name: String(form.get('name') || '').slice(0, 80),
    p_email: String(form.get('email') || '').slice(0, 200),
    p_body: String(form.get('body') || '').slice(0, 4000),
  });
  if (error) redirect('/maintenance?error=' + encodeURIComponent(/function|schema cache/i.test(error.message) ? 'Please email support@scoredate.app.' : error.message) + '#contact');
  redirect('/maintenance?sent=1#contact');
}
