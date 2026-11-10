import 'server-only';
import webpush from 'web-push';
import { supabaseAnon } from '@/lib/supabase/server';
import { sendBatch } from '@/lib/mailer';
import { unsubUrl, type UnsubKind } from '@/lib/unsub';
import { SITE_URL } from '@/lib/emails';
import { fcmReady, sendNativePush } from '@/lib/fcm';
import { apnsReady, sendApns, sendApnsDetail } from '@/lib/apns';

type Sub = { endpoint: string; p256dh: string; auth: string };
type Claimed = {
  id: string; user_id: string; kind: string; category: 'interaction' | 'reminder' | 'milestone' | 'nudge';
  title: string; body: string; url: string; first_name: string | null; email: string | null; subs: Sub[] | null;
};

let configured: boolean | null = null;
function pushReady() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@scoredate.app', pub!, priv!);
  return configured;
}

const unsubKind = (n: Claimed): UnsubKind =>
  n.category === 'interaction' ? 'messages' : n.kind === 'event_tomorrow' || n.kind === 'waitlist_in' ? 'events' : 'reminders';

/**
 * Deliver queued notifications: web push to every device the member enabled, and email where their
 * preferences allow. The database decides who gets what (prefs, quiet hours, blocks) and marks rows
 * as claimed, so overlapping calls never double-send. Never throws.
 */
export async function flushNotifications(actorId: string | null = null, limit = 100) {
  const out = { claimed: 0, pushed: 0, dead: 0, emailed: 0, error: undefined as string | undefined };
  try {
    const sb = supabaseAnon();
    const secret = process.env.SCORE_SERVER_SECRET;
    const { data, error } = await sb.rpc('claim_notifications', { p_secret: secret, p_actor: actorId, p_limit: limit });
    if (error) throw new Error(error.message);
    const rows = (data as Claimed[]) || [];
    out.claimed = rows.length;
    if (!rows.length) return out;

    if (pushReady()) {
      const jobs: Promise<void>[] = [];
      for (const n of rows) for (const s of n.subs || []) {
        const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.kind + ':' + n.url, id: n.id });
        jobs.push(webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12, urgency: n.category === 'interaction' ? 'high' : 'normal' })
          .then(() => { out.pushed++; return sb.rpc('push_result', { p_secret: secret, p_endpoint: s.endpoint, p_ok: true }); })
          .catch((e: { statusCode?: number }) => {
            if (e?.statusCode === 404 || e?.statusCode === 410) { out.dead++; return sb.rpc('push_result', { p_secret: secret, p_endpoint: s.endpoint, p_ok: false }); }
          })
          .then(() => undefined, () => undefined));
      }
      await Promise.all(jobs);
    }

    // Native app push (iPhone / Android) for members who installed the app.
    if (fcmReady() || apnsReady()) {
      const { data: toks } = await sb.rpc('native_tokens_for', { p_secret: secret, p_users: [...new Set(rows.map((r) => r.user_id))] });
      const byUser = new Map<string, { token: string; platform: string }[]>();
      for (const t of (toks as { user_id: string; token: string; platform: string }[]) || []) byUser.set(t.user_id, [...(byUser.get(t.user_id) || []), t]);
      // iPhone tokens from the Capacitor app are raw APNs tokens; Android tokens go through Firebase.
      const send = async (t: { token: string; platform: string }, msg: Parameters<typeof sendApns>[1]) => {
        if (t.platform === 'ios' && apnsReady()) {
          const d = await sendApnsDetail(t.token, msg);
          await sb.rpc('native_push_result', { p_secret: secret, p_token: t.token, p_result: d.result === 'ok' ? `ok (${d.host})` : `${d.result}: ${d.status} ${d.reason || ''}`.trim() }).then(() => undefined, () => undefined);
          return d.result;
        }
        return fcmReady() ? sendNativePush(t.token, msg) : ('error' as const);
      };
      await Promise.all(rows.flatMap((n) => (byUser.get(n.user_id) || []).map(({ token: tk, platform }) =>
        send({ token: tk, platform }, { title: n.title, body: n.body, url: n.url, tag: n.kind, high: n.category === 'interaction' }).then((r) => {
          if (r === 'ok') out.pushed++;
          if (r === 'dead') { out.dead++; return sb.rpc('native_token_dead', { p_secret: secret, p_token: tk }).then(() => undefined, () => undefined); }
        }))));
    }

    const mail = rows.filter((n) => n.email);
    if (mail.length) {
      const r = await sendBatch('notification', mail.map((n) => ({
        to: n.email!,
        data: { first_name: n.first_name, title: n.title, body: n.body, url: n.url.startsWith('http') ? n.url : SITE_URL + n.url, category: n.category },
        unsubUrl: unsubUrl(n.user_id, unsubKind(n)),
      })));
      out.emailed = r.sent;
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : 'flush failed';
  }
  return out;
}
