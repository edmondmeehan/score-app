import { NextResponse, after, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';
import { trackEvent } from '@/lib/track';
import { flushNotifications } from '@/lib/notify';

/**
 * Email links from Supabase land here with a one-time token_hash (password reset, confirm email,
 * sign-in link, email change). Unlike the ?code= flow this works even if the email is opened on a
 * different phone or browser than the one that asked for it.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') || '';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '';
  const fail = (msg: string, mode = 'signin') => NextResponse.redirect(new URL(`/signin?mode=${mode}&error=${encodeURIComponent(msg)}`, url.origin));

  if (!tokenHash || !type) return fail('That link is incomplete. Request a new one.');
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return type === 'recovery'
      ? fail('That reset link expired or was already used. Request a new one.', 'reset')
      : fail('That link expired or was already used. Sign in or request a new one.');
  }

  if (type === 'recovery') return NextResponse.redirect(new URL('/signin/new-password', url.origin));

  // Confirm / sign-in links: apply a saved invite code, same as the password sign-in.
  const store = await cookies();
  const invite = store.get('score_invite')?.value;
  if (invite) {
    const { error: e } = await supabase.rpc('redeem_invite', { p_code: invite });
    if (!e) {
      const { data: { user } } = await supabase.auth.getUser();
      await trackEvent('invite_redeemed', user?.id);
      if (user) after(() => flushNotifications(user.id, 10));
    }
    store.delete('score_invite');
  }
  return NextResponse.redirect(new URL(next || (type === 'signup' ? '/onboarding' : '/app'), url.origin));
}
