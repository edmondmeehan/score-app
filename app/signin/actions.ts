'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';

export async function sendLink(form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const next = String(form.get('next') || '');
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `https://${h.get('host')}`;
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next.startsWith('/') ? next : '')}` },
  });
  if (error) redirect('/signin?error=' + encodeURIComponent(error.message));
  redirect('/signin?sent=' + encodeURIComponent(email));
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/');
}
