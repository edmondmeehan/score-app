import 'server-only';
import { headers } from 'next/headers';
import { supabaseAnon } from '@/lib/supabase/server';
import { flushNotifications } from '@/lib/notify';

/** After a sign-in: if it's the App Review account, log where it came from and alert the owners (migration 0086). Never throws. */
export async function logReviewerSignIn(userId: string) {
  try {
    const h = await headers();
    const dec = (v: string | null) => { try { return v ? decodeURIComponent(v) : null; } catch { return v; } };
    const { data } = await supabaseAnon().rpc('reviewer_log_login', {
      p_secret: process.env.SCORE_SERVER_SECRET, p_user: userId,
      p_ip: (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim() || null,
      p_city: dec(h.get('x-vercel-ip-city')), p_region: h.get('x-vercel-ip-country-region'), p_country: h.get('x-vercel-ip-country'),
      p_ua: h.get('user-agent'),
    });
    // Send the owners' alert now (push + email) instead of waiting for the next scheduled run.
    if ((data as { reviewer?: boolean } | null)?.reviewer) await flushNotifications(null, 25);
  } catch (e) {
    console.error('[reviewer-log]', (e as Error).message);
  }
}
