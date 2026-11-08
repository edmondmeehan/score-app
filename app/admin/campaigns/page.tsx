import { requireStaff } from '@/lib/session';
import { addSpend, removeSpend } from './actions';

export const dynamic = 'force-dynamic';

type Row = { channel: string; campaign: string; signups: number; qualified: number; referrals_brought: number; spend: number; members?: number; paying?: number; revenue?: number };
type Report = { rows: Row[]; total_signups: number; total_qualified: number; total_spend: number; total_members?: number; total_paying?: number; total_revenue?: number; paid_paying?: number; paid_revenue?: number; by_day: { day: string; signups: number; paid: number }[] };
type Spend = { id: string; day: string; channel: string; campaign: string | null; amount: number; note: string | null };

const LABEL: Record<string, string> = { meta: 'Meta', google: 'Google', chatgpt: 'ChatGPT', youtube: 'YouTube / AdMob', creators: 'Creators', other: 'Other paid', referral: 'Referral', organic: 'Organic / direct' };
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const per = (spend: number, n: number) => (spend && n ? usd(Math.round((spend / n) * 100) / 100) : '—');
const iso = (d: Date) => d.toISOString().slice(0, 10);

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app').replace(/\/$/, '');
const LINKS: [string, string][] = [
  ['Meta ads', `${SITE}/meet?utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}#invite`],
  ['Google Search', `${SITE}/meet?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}#invite`],
  ['YouTube / AdMob', `${SITE}/meet?utm_source=youtube&utm_medium=paid_video&utm_campaign=CAMPAIGN#invite`],
  ['ChatGPT ads', `${SITE}/meet?utm_source=chatgpt&utm_medium=paid_ai&utm_campaign=CAMPAIGN#invite`],
  ['A creator', `${SITE}/meet?utm_source=creator&utm_medium=influencer&utm_campaign=CREATOR-HANDLE#invite`],
];

export default async function Campaigns({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : iso(new Date());
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : iso(new Date(Date.now() - 55 * 86400000));
  const [{ data, error }, { data: spendRows }] = await Promise.all([
    supabase.rpc('staff_campaign_report', { p_from: from, p_to: to }),
    supabase.from('ad_spend').select('id, day, channel, campaign, amount, note').gte('day', from).lte('day', to).order('day', { ascending: false }).limit(60),
  ]);
  const notReady = error && /Could not find the function|schema cache/i.test(error.message);
  const r = (data as Report) || { rows: [], total_signups: 0, total_qualified: 0, total_spend: 0, by_day: [] };
  const paidSignups = r.rows.filter((x) => !['referral', 'organic'].includes(x.channel)).reduce((s, x) => s + x.signups, 0);
  const max = Math.max(1, ...r.by_day.map((d) => d.signups));

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Campaigns</h1>
      <span className="small muted">Waitlist signups by where they first came from, against what you spent. A signup is credited to the first campaign link that brought that browser to scoredate.app. Qualified = a zip code in an open area. Members, Paying and Revenue follow those same sign-ups after they join, so CAC = spend ÷ paying members. Recent campaigns need time to convert.</span>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {notReady && <div className="notice error">Run migration 0029 in the ScoreDate SQL Editor first.</div>}

      <form className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="stack small" style={{ gap: 4 }}>From<input className="input" type="date" name="from" defaultValue={from} /></label>
        <label className="stack small" style={{ gap: 4 }}>To<input className="input" type="date" name="to" defaultValue={to} /></label>
        <button className="btn ghost sm">Update</button>
      </form>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {[
          [r.total_signups.toLocaleString('en-US'), 'Waitlist signups', `${r.total_qualified.toLocaleString('en-US')} qualified`],
          [usd(r.total_spend), 'Ad spend', 'Entered below'],
          [per(r.total_spend, paidSignups), 'Cost per paid signup', `${paidSignups.toLocaleString('en-US')} from paid channels`],
          [per(r.total_spend, r.total_signups), 'Blended cost per signup', 'Spend ÷ all signups'],
          [per(r.total_spend, r.paid_paying || 0), 'Cost per paying member (CAC)', `${(r.paid_paying || 0).toLocaleString('en-US')} paying from paid channels`],
          [r.total_spend ? `${((r.paid_revenue || 0) / r.total_spend).toFixed(2)}×` : '—', 'Return on ad spend', `${usd(r.paid_revenue || 0)} revenue from paid channels`],
        ].map(([n, l, s]) => (
          <div key={l} className="card stack" style={{ gap: 4, flex: '1 1 150px' }}>
            <span className="serif" style={{ fontSize: 30, lineHeight: 1 }}>{n}</span><span className="small">{l}</span><span className="small muted">{s}</span>
          </div>
        ))}
      </div>

      {r.by_day.length > 1 && (
        <div className="card stack" style={{ gap: 8 }}>
          <div className="row small" style={{ justifyContent: 'space-between' }}><strong>Signups per day</strong><span className="muted">gold = paid channels</span></div>
          <svg viewBox="0 0 720 120" width="100%" preserveAspectRatio="none" style={{ height: 120 }} role="img" aria-label="Signups per day">
            {r.by_day.map((d, i) => {
              const bw = 720 / r.by_day.length, h = (d.signups / max) * 110, hp = (d.paid / max) * 110;
              return <g key={d.day}><rect x={i * bw + 1} y={118 - h} width={Math.max(1, bw - 2)} height={h} fill="var(--track)"><title>{`${d.day}: ${d.signups} signups, ${d.paid} paid`}</title></rect><rect x={i * bw + 1} y={118 - hp} width={Math.max(1, bw - 2)} height={hp} fill="var(--gold)" /></g>;
            })}
          </svg>
        </div>
      )}

      <section className="card scroll-x" style={{ overflowX: 'auto' }}>
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>Channel</th><th>Campaign</th><th>Spend</th><th>Signups</th><th>Qualified</th><th>Members</th><th>Paying</th><th>Revenue</th><th>Cost / signup</th><th>Cost / paying (CAC)</th><th>Return</th><th>Friends referred</th></tr></thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={`${x.channel}-${x.campaign}`}>
                <td>{LABEL[x.channel] || x.channel}</td><td className="mono small">{x.campaign || '—'}</td><td>{x.spend ? usd(x.spend) : '—'}</td>
                <td>{x.signups.toLocaleString('en-US')}</td><td>{x.qualified.toLocaleString('en-US')}</td>
                <td>{(x.members || 0).toLocaleString('en-US')}</td><td>{(x.paying || 0).toLocaleString('en-US')}</td><td>{x.revenue ? usd(Number(x.revenue)) : '—'}</td>
                <td>{per(x.spend, x.signups)}</td><td>{per(x.spend, x.paying || 0)}</td><td>{x.spend && x.revenue ? `${(Number(x.revenue) / x.spend).toFixed(2)}×` : '—'}</td><td>{x.referrals_brought}</td>
              </tr>
            ))}
            {r.rows.length === 0 && <tr><td colSpan={12} className="small muted">No signups in this range yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <section className="card stack" style={{ gap: 10 }}>
          <strong>Add ad spend</strong>
          <span className="small muted">Enter totals from each ad platform (daily or weekly). Use the same campaign name as utm_campaign so they line up.</span>
          <form action={addSpend} className="stack" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input className="input" type="date" name="day" defaultValue={iso(new Date())} required />
              <select className="input" name="channel" defaultValue="meta">{['meta', 'google', 'chatgpt', 'youtube', 'creators', 'other'].map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}</select>
              <input className="input" name="amount" placeholder="Amount ($)" inputMode="decimal" required style={{ width: 130 }} />
            </div>
            <input className="input" name="campaign" placeholder="Campaign (optional, match utm_campaign)" />
            <input className="input" name="note" placeholder="Note (optional)" />
            <button className="btn sm" style={{ alignSelf: 'flex-start' }}>Save spend</button>
          </form>
          {(spendRows as Spend[] | null)?.map((s) => (
            <form key={s.id} action={removeSpend} className="row small" style={{ justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 6 }}>
              <input type="hidden" name="id" value={s.id} />
              <span>{s.day} · {LABEL[s.channel]}{s.campaign ? ` · ${s.campaign}` : ''} · <strong>{usd(Number(s.amount))}</strong>{s.note ? <span className="muted"> · {s.note}</span> : null}</span>
              <button className="btn ghost sm">Remove</button>
            </form>
          ))}
        </section>

        <section className="card stack" style={{ gap: 10 }}>
          <strong>Links to use in ads</strong>
          <span className="small muted">Every ad and creator post should use one of these so signups get credited. Meta and Google fill in the parts in braces automatically; replace CAPITALS yourself.</span>
          {LINKS.map(([l, u]) => (
            <div key={l} className="stack" style={{ gap: 2 }}><span className="small">{l}</span><code className="mono small" style={{ overflowWrap: 'anywhere', color: 'var(--muted)' }}>{u}</code></div>
          ))}
        </section>
      </div>
    </>
  );
}
