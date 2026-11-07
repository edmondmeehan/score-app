'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

const KINDS = ['venue', 'brand', 'financial', 'events', 'press', 'other'];

export async function submitInquiry(form: FormData) {
  const v = (k: string) => String(form.get(k) || '').trim();
  const fail = (m: string) => redirect('/partners?error=' + encodeURIComponent(m) + '#contact');
  if (v('company_website_confirm')) redirect('/partners?sent=1'); // honeypot
  const kind = KINDS.includes(v('kind')) ? v('kind') : 'other';
  if (v('name').length < 2 || v('company').length < 2) fail('Add your name and company.');
  if (!/^\S+@\S+\.\S+$/.test(v('email'))) fail('Add a valid email.');
  if (v('message').length < 10) fail('Tell us a little about what you have in mind.');
  const supabase = await supabaseServer();
  const { error } = await supabase.from('partner_inquiries').insert({
    name: v('name').slice(0, 80), company: v('company').slice(0, 120), email: v('email').toLowerCase().slice(0, 160), kind,
    website: v('website').slice(0, 200) || null, message: v('message').slice(0, 2000),
  });
  if (error) fail('Something went wrong. Email partners@scoredate.app instead.');
  redirect('/partners?sent=1#contact');
}
