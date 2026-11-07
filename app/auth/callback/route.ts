import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';
import { trackEvent } from '@/lib/track';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '';
  const supabase = await supabaseServer();
  if (code) await supabase.auth.exchangeCodeForSession(code);
  const store = await cookies();
  const invite = store.get('score_invite')?.value;
  if (invite) {
    const { error } = await supabase.rpc('redeem_invite', { p_code: invite });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await trackEvent('invite_redeemed', user?.id);
    }
    store.delete('score_invite');
  }
  const dest = next.startsWith('/') && !next.startsWith('//') ? next : '/onboarding';
  return NextResponse.redirect(new URL(dest, url.origin));
}
