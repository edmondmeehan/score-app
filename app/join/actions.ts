'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export async function saveInvite(form: FormData) {
  const code = String(form.get('code') || '').trim().toUpperCase();
  if (!/^SCR-[A-Z0-9]{4}-[A-Z0-9]{3}$/.test(code)) redirect('/join?error=' + encodeURIComponent('That code doesn’t look right. It looks like SCR-XXXX-XXX.'));
  const store = await cookies();
  store.set('score_invite', code, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 7, path: '/' });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase.rpc('redeem_invite', { p_code: code });
    if (data !== 'ok') redirect('/join?error=' + encodeURIComponent(data === 'expired' ? 'That invite has expired.' : data === 'used' ? 'That invite was already used.' : 'We couldn’t find that invite.'));
    store.delete('score_invite');
    redirect('/onboarding');
  }
  redirect('/signin?next=/onboarding');
}
