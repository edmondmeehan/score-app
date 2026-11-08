import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase/server';
import { sendBatch } from '@/lib/mailer';
import { unsubUrl } from '@/lib/unsub';
import { flushNotifications } from '@/lib/notify';
import { reportBlocks } from '@/lib/adminReport';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Row = { user_id: string; email: string | null; first_name: string | null } & Record<string, unknown>;

/**
 * Scheduled emails. Vercel Cron calls this (see vercel.json) with "Authorization: Bearer <CRON_SECRET>".
 * ?job=frequent → new-message digests, Preview reminders, re-verify reminders, housekeeping
 * ?job=daily    → Daily Drop email
 * Each job claims recipients in the database first, so overlapping runs never double-send.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') || '';
  const allowed = [process.env.CRON_SECRET, process.env.SCORE_SERVER_SECRET].filter(Boolean).map((s) => `Bearer ${s}`);
  if (!allowed.includes(auth)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const job = new URL(request.url).searchParams.get('job') || 'frequent';
  const sb = supabaseAnon();
  const secret = process.env.SCORE_SERVER_SECRET;
  const claim = async (kind: string): Promise<Row[]> => {
    const { data, error } = await sb.rpc('cron_claim_emails', { p_secret: secret, p_kind: kind, p_limit: 500 });
    if (error) throw new Error(`${kind}: ${error.message}`);
    return ((data as Row[]) || []).filter((r) => r.email);
  };
  const out: Record<string, unknown> = { job };

  try {
    if (job === 'daily') {
      const rows = await claim('daily_drop');
      out.daily_drop = await sendBatch('daily_drop', rows.map((r) => ({
        to: r.email!, data: { first_name: r.first_name, count: Number(r.count) || 5 }, unsubUrl: unsubUrl(r.user_id, 'daily_drop'),
      })));
      // Staff daily report (each person once per day, only the sections they picked).
      const rep = await sb.rpc('cron_daily_report', { p_secret: secret });
      if (rep.error) out.admin_daily = rep.error.message;
      else {
        const r = rep.data as { recipients: { email: string; sections: string[] }[]; data?: Record<string, Record<string, unknown>> };
        const date = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
        out.admin_daily = r.recipients.length && r.data
          ? await sendBatch('admin_daily', r.recipients.map((x) => ({ to: x.email, data: { date, ...reportBlocks(r.data as never, x.sections) } })))
          : 0;
      }
    } else {
      const housekeeping = await sb.rpc('cron_housekeeping', { p_secret: secret });
      out.housekeeping = housekeeping.data ?? housekeeping.error?.message;

      const msgs = await claim('messages');
      out.messages = await sendBatch('new_message', msgs.map((r) => ({
        to: r.email!, data: { first_name: r.first_name, from_name: String(r.from_name || 'Someone'), conversation_id: String(r.conversation_id), count: Number(r.count) || 1 },
        unsubUrl: unsubUrl(r.user_id, 'messages'),
      })));

      const preview = await claim('preview_ending');
      out.preview_ending = await sendBatch('preview_ending', preview.map((r) => ({
        to: r.email!, data: { first_name: r.first_name, days_left: Number(r.days_left) || 1 }, unsubUrl: unsubUrl(r.user_id, 'reminders'),
      })));

      const reverify = await claim('reverify');
      out.reverify = await sendBatch('reverify_reminder', reverify.map((r) => ({
        to: r.email!, data: { first_name: r.first_name, due: String(r.due || 'soon') }, unsubUrl: unsubUrl(r.user_id, 'reminders'),
      })));
    }
    // Activity notifications: queue reminders, milestones and nudges, then deliver everything pending.
    const queued = await sb.rpc('queue_scheduled_notifications', { p_secret: secret, p_job: job === 'daily' ? 'daily' : 'frequent' });
    out.notifications_queued = queued.data ?? queued.error?.message;
    out.notifications = await flushNotifications(null, 500);
  } catch (e) {
    out.error = e instanceof Error ? e.message : 'failed';
    return NextResponse.json(out, { status: 500 });
  }
  return NextResponse.json(out);
}
