'use server';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { supabaseAnon } from '@/lib/supabase/server';
import { apnsReady, sendApnsDetail } from '@/lib/apns';

/** Send a push straight to this member's registered phones and show Apple's exact reply. */
export async function testPush(form: FormData) {
  await requireStaff();
  const id = String(form.get('id'));
  const back = (msg: string) => redirect(`/admin/members/${id}?push=${encodeURIComponent(msg)}#push`);
  if (!apnsReady()) back('The Apple push keys aren’t active on the server. Check APNS_KEY, APNS_KEY_ID and APNS_TEAM_ID in Vercel, then redeploy.');
  const sb = supabaseAnon(); const secret = process.env.SCORE_SERVER_SECRET;
  const { data, error } = await sb.rpc('native_tokens_for', { p_secret: secret, p_users: [id] });
  if (error) back(`Couldn’t read devices: ${error.message}`);
  const toks = ((data as { token: string; platform: string }[]) || []).filter((t) => t.platform === 'ios');
  if (!toks.length) back('No iPhone is registered for push yet. Open the ScoreDate app on the phone (allow notifications), then try again.');
  const out: string[] = [];
  for (const t of toks) {
    const d = await sendApnsDetail(t.token, { title: 'ScoreDate push check', body: 'If you can see this, push notifications work.', url: '/app/activity', tag: 'push-check', high: true });
    const result = d.result === 'ok' ? `ok (${d.host})` : `${d.result}: ${d.status} ${d.reason || ''}`.trim();
    await sb.rpc('native_push_result', { p_secret: secret, p_token: t.token, p_result: result }).then(() => null, () => null);
    if (d.result === 'dead') await sb.rpc('native_token_dead', { p_secret: secret, p_token: t.token }).then(() => null, () => null);
    out.push(`…${t.token.slice(-6)}: ${d.result === 'ok' ? `Apple accepted it (${d.host})` : `Apple said ${d.status || 'no reply'} ${d.reason || ''}`}`);
  }
  back(out.join(' · '));
}
