'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAnon } from '@/lib/supabase/server';
import { INVESTOR_COOKIE, hashPassword, newToken, sha256 } from '@/lib/investors';

export async function investorLogin(form: FormData) {
  const name = String(form.get('name') || '').trim().slice(0, 80);
  const pw = String(form.get('password') || '');
  if (!name || !pw) redirect('/investors?e=missing');
  const sb = supabaseAnon();
  const { data: salt, error: e1 } = await sb.rpc('investor_salt');
  if (e1) redirect('/investors?e=setup');
  if (!salt) redirect('/investors?e=closed');
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const token = newToken();
  const { data: result, error } = await sb.rpc('investor_login', {
    p_hash: hashPassword(pw, salt as string), p_token_hash: sha256(token), p_label: name, p_ip_hash: sha256('inv:' + ip),
  });
  if (error) redirect('/investors?e=setup');
  if (result === 'locked') redirect('/investors?e=locked');
  if (result === 'not_set') redirect('/investors?e=closed');
  if (result !== 'ok') redirect('/investors?e=wrong');
  (await cookies()).set(INVESTOR_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/investors', maxAge: 60 * 60 * 24 * 14 });
  redirect('/investors');
}

export async function investorLogout() {
  const store = await cookies();
  const token = store.get(INVESTOR_COOKIE)?.value;
  if (token) await supabaseAnon().rpc('investor_logout', { p_token_hash: sha256(token) });
  store.delete({ name: INVESTOR_COOKIE, path: '/investors' });
  redirect('/investors');
}
