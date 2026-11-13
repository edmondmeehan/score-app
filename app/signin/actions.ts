'use server';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { cookies, headers } from 'next/headers';
import { afterSignIn } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';
import { trackEvent } from '@/lib/track';
import { clientIp, verifyHuman } from '@/lib/turnstile';
import { flushNotifications } from '@/lib/notify';

const safeNext = (n: string) => (n.startsWith('/') && !n.startsWith('//') ? n : '');
const back = (mode: string, next: string, msg: string, email = '') =>
  redirect(`/signin?mode=${mode}&next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}&error=${encodeURIComponent(msg)}`);

async function origin() {
  const h = await headers();
  return (process.env.NEXT_PUBLIC_SITE_URL || `https://${h.get('host')}`).replace(/\/$/, '');
}

/** After any successful sign-in: redeem a saved invite code, then go on. */
async function finish(next: string, fallback: string) {
  const supabase = await supabaseServer();
  const store = await cookies();
  const invite = store.get('score_invite')?.value;
  if (invite) {
    const { error } = await supabase.rpc('redeem_invite', { p_code: invite });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await trackEvent('invite_redeemed', user?.id);
      if (user) after(() => flushNotifications(user.id, 10));
    }
    store.delete('score_invite');
  }
  redirect(await afterSignIn(supabase, safeNext(next) || fallback));
}

export async function signInPassword(form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const next = String(form.get('next') || '');
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = /confirm/i.test(error.message)
      ? 'Confirm your email first, then sign in.'
      : 'That email and password don’t match. Try again or reset your password.';
    back('signin', next, msg, email);
  }
  await finish(next, '/app');
}

export async function signUpPassword(form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const next = String(form.get('next') || '');
  if (password.length < 8) back('signup', next, 'Use at least 8 characters for your password.', email);
  if (password !== String(form.get('confirm') || '')) back('signup', next, 'Those passwords don’t match.', email);
  if (!(await verifyHuman(form, await clientIp(), 'signup'))) back('signup', next, 'Please confirm you’re not a bot, then try again.', email);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error) {
    const msg = /registered|exists/i.test(error.message) ? 'You already have an account. Sign in instead.' : error.message;
    back(/registered|exists/i.test(error.message) ? 'signin' : 'signup', next, msg, email);
  }
  // Supabase returns a user with no identities when the email is already taken.
  if (data.user && data.user.identities?.length === 0) back('signin', next, 'You already have an account. Sign in instead.', email);
  if (!data.session) redirect('/signin?sent=' + encodeURIComponent(email) + '&kind=confirm');
  await trackEvent('signup', data.user?.id);
  await finish(next, '/onboarding');
}

export async function sendReset(form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/callback?next=/signin/new-password` });
  if (error) back('reset', '', error.message, email);
  redirect('/signin?sent=' + encodeURIComponent(email) + '&kind=reset');
}

export async function setNewPassword(form: FormData) {
  const password = String(form.get('password') || '');
  if (password.length < 8) redirect('/signin/new-password?error=' + encodeURIComponent('Use at least 8 characters.'));
  if (password !== String(form.get('confirm') || '')) redirect('/signin/new-password?error=' + encodeURIComponent('Those passwords don’t match.'));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/signin/new-password?error=' + encodeURIComponent(error.message));
  redirect(String(form.get('next') || '') === 'settings' ? '/app/settings?saved=password' : '/app');
}

/** Kept for links already sent: email sign-in link. */
export async function sendLink(form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const next = String(form.get('next') || '');
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error) back('link', next, error.message, email);
  redirect('/signin?sent=' + encodeURIComponent(email) + '&kind=link');
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  // In the iPhone/Android app, go back to the app's start screen (sign in / invite code); on the web, the home page.
  const ua = (await headers()).get('user-agent') || '';
  redirect(/ScoreDateApp/.test(ua) ? '/join' : '/');
}
