import 'server-only';
import { createHash, randomUUID } from 'crypto';
import { cookies, headers } from 'next/headers';
import { ATTR_COOKIE, ADS_OPTOUT_COOKIE } from '@/lib/adsShared';

/** True when this visitor has opted out of ad measurement (our toggle or a Global Privacy Control signal). */
async function optedOut() {
  const jar = await cookies();
  const h = await headers();
  return jar.get(ADS_OPTOUT_COOKIE)?.value === 'off' || h.get('sec-gpc') === '1';
}

/** Save the first-touch campaign (from the score_attr cookie) onto a new waitlist signup. First-party only. */
export async function recordAttribution(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret = process.env.SCORE_SERVER_SECRET;
  if (!url || !key || !secret) return;
  try {
    const raw = (await cookies()).get(ATTR_COOKIE)?.value;
    if (!raw) return;
    const attr = JSON.parse(decodeURIComponent(raw));
    await fetch(`${url}/rest/v1/rpc/set_waitlist_attribution`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, p_email: email, p_attr: attr }),
    });
  } catch { /* never block a signup */ }
}

/**
 * Meta Conversions API "Lead" for a waitlist signup. Sends only a hashed email, the browser's Meta cookies,
 * user agent and IP, plus an event ID shared with the browser pixel so Meta counts it once.
 * Off unless META_PIXEL_ID and META_CAPI_TOKEN are set, and skipped for anyone who opted out.
 */
export async function sendMetaLead(email: string, eventId: string) {
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token || (await optedOut())) return;
  try {
    const jar = await cookies();
    const h = await headers();
    const sha = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
    const user_data: Record<string, unknown> = {
      em: [sha(email)],
      client_user_agent: h.get('user-agent') || undefined,
      client_ip_address: (h.get('x-forwarded-for') || '').split(',')[0].trim() || undefined,
      fbp: jar.get('_fbp')?.value, fbc: jar.get('_fbc')?.value,
    };
    const body: Record<string, unknown> = {
      data: [{ event_name: 'Lead', event_time: Math.floor(Date.now() / 1000), event_id: eventId, action_source: 'website',
        event_source_url: h.get('referer') || process.env.NEXT_PUBLIC_SITE_URL, user_data }],
    };
    if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
    await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch { /* never block a signup */ }
}

export const newEventId = () => randomUUID();
