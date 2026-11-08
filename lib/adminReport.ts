import type { Block } from '@/lib/emails';

export const REPORT_SECTIONS = [
  ['finance', 'Finance', 'Revenue, new subscriptions, cancellations, estimated MRR'],
  ['members', 'Members', 'Sign-ups, ID checks, plans, paused'],
  ['waitlist', 'Waitlist', 'New joins, referrals, Founding Members, top areas'],
  ['engagement', 'Engagement', 'Daily and weekly actives, conversations, messages, dates'],
  ['safety', 'Safety & support', 'Open reports, verification queue, support tickets, deletions'],
] as const;
export type SectionKey = (typeof REPORT_SECTIONS)[number][0];

type D = Record<string, Record<string, any>>;
const usd = (n: number) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => (Number(n) || 0).toLocaleString('en-US');
const vs = (today: number, avg: number) => (avg > 0 ? ` (7-day avg ${Number(avg).toLocaleString('en-US')})` : '');
const PLAN: Record<string, string> = { membership: 'Membership', premium: 'Premium', black: 'Reserve', preview: 'Preview', paused: 'Paused' };

/** Turns the report data into email blocks, only for the sections this person chose. */
export function reportBlocks(d: D, sections: string[]): { blocks: Block[]; headline: string } {
  const out: Block[] = [];
  const has = (k: SectionKey) => sections.includes(k);
  const f = d.finance || {}, m = d.members || {}, w = d.waitlist || {}, e = d.engagement || {}, s = d.safety || {};
  if (has('finance')) {
    out.push({ p: 'Finance' }, { facts: [
      ['Revenue, last 24 hours', usd(f.gross_24h) + (f.avg_day_prev7 > 0 ? ` (7-day avg ${usd(f.avg_day_prev7)})` : '')],
      ['Revenue, month to date', usd(f.gross_mtd)],
      ['Refunds, last 24 hours', usd(f.refunds_24h)],
      ['New subscriptions', num(f.new_subs_24h)],
      ['Renewals', num(f.renewals_24h)],
      ['Cancellations', num(f.cancellations_24h)],
      ['Billing issues', num(f.billing_issues_24h)],
      ['Estimated MRR', usd(f.mrr_estimate)],
    ] });
  }
  if (has('members')) {
    const plans = Object.entries((m.by_plan || {}) as Record<string, number>).map(([k, v]) => `${PLAN[k] || k} ${num(v)}`).join(' · ') || 'None yet';
    out.push({ p: 'Members' }, { facts: [
      ['New sign-ups', num(m.signups_24h) + vs(m.signups_24h, m.signups_prev7_avg)],
      ['ID verified (new)', num(m.id_verified_24h)],
      ['Active members', num(m.active)],
      ['On Preview', num(m.preview)],
      ['Paused or Taken', num(m.paused)],
      ['By plan', plans],
    ] });
  }
  if (has('waitlist')) {
    const areas = ((w.top_areas_24h || []) as { area: string; n: number }[]).map((a) => `${a.area} ${a.n}`).join(' · ') || '—';
    out.push({ p: 'Waitlist' }, { facts: [
      ['New joins', num(w.joins_24h) + vs(w.joins_24h, w.joins_prev7_avg)],
      ['Joined through a friend', num(w.referred_24h)],
      ['Total waitlist', num(w.total)],
      ['Still waiting', num(w.waiting)],
      ['Founding Members', num(w.founders)],
      ['Top areas today', areas],
    ] });
  }
  if (has('engagement')) {
    out.push({ p: 'Engagement' }, { facts: [
      ['Active today', num(e.dau)],
      ['Active this week', num(e.wau)],
      ['New conversations', num(e.conversations_24h)],
      ['Messages sent', num(e.messages_24h)],
      ['Dates proposed', num(e.dates_proposed_24h)],
    ] });
  }
  if (has('safety')) {
    out.push({ p: 'Safety & support' }, { facts: [
      ['Open reports', num(s.open_reports)],
      ['New reports, last 24 hours', num(s.reports_24h)],
      ['ID or photo reviews waiting', num(s.verification_queue)],
      ['Open support tickets', num(s.support_open)],
      ['Deletion requests', num(s.deletions_pending)],
      ['Suspended accounts', num(s.suspended)],
    ] });
    if (Number(s.open_reports) > 0 || Number(s.verification_queue) > 0) out.push({ note: 'Reports and reviews are waiting in Admin → Moderation and Verification.' });
  }
  const parts: string[] = [];
  if (has('finance')) parts.push(`${usd(f.gross_24h)} revenue`);
  if (has('members')) parts.push(`${num(m.signups_24h)} sign-ups`);
  if (has('waitlist')) parts.push(`${num(w.joins_24h)} waitlist joins`);
  if (has('safety') && Number(s.open_reports) > 0) parts.push(`${num(s.open_reports)} open reports`);
  return { blocks: out, headline: parts.join(' · ') || 'Your daily ScoreDate report' };
}
