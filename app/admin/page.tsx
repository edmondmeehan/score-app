import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { BANDS, PLANS, type Band } from '@/lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type KV = { k: string; v: number; n?: number };
const usd = (n: number | null | undefined, cents = false) =>
  (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 });
const num = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('en-US');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const GENDERS: [string, string, string][] = [['woman', 'Female', 'var(--gold)'], ['man', 'Male', 'var(--rise)'], ['nonbinary', 'Other', 'var(--gold-light)'], ['unset', 'Not set', 'var(--line-soft)']];
const STORE: Record<string, string> = { APP_STORE: 'Apple', PLAY_STORE: 'Google Play', STRIPE: 'Web (Stripe)', PROMOTIONAL: 'Promotional', unknown: 'Unknown' };
const PLAN_NAME = (p: string) => (PLANS as Record<string, { name: string }>)[p]?.name || p.charAt(0).toUpperCase() + p.slice(1);

function Tile({ label, value, sub, href, alert }: { label: string; value: string; sub?: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <span className="small muted">{label}</span>
      <span className="serif" style={{ fontSize: 32, lineHeight: 1.05, color: alert ? 'var(--alert)' : undefined }}>{value}</span>
      {sub && <span className="small muted">{sub}</span>}
    </>
  );
  return href
    ? <Link href={href} className="card stack" style={{ gap: 6, textDecoration: 'none', color: 'inherit' }}>{body}</Link>
    : <div className="card stack" style={{ gap: 6 }}>{body}</div>;
}

function Bars({ data, money }: { data: { day: string; v: number }[]; money?: boolean }) {
  if (!data.length) return <span className="small muted">No activity in this period yet.</span>;
  const max = Math.max(...data.map((d) => Number(d.v) || 0), 1);
  return (
    <div className="row" style={{ alignItems: 'flex-end', gap: 3, height: 90 }} role="img" aria-label="Daily chart">
      {data.map((d) => (
        <div key={d.day} title={`${d.day}: ${money ? usd(d.v, true) : num(d.v)}`}
          style={{ flex: 1, minWidth: 3, height: `${Math.max(4, (Math.max(0, Number(d.v)) / max) * 100)}%`, background: 'var(--gold)', borderRadius: 3, opacity: 0.85 }} />
      ))}
    </div>
  );
}

function Split({ rows, money }: { rows: KV[]; money?: boolean }) {
  const total = rows.reduce((s, r) => s + Math.max(0, Number(r.v) || 0), 0);
  if (!rows.length) return <span className="small muted">Nothing yet.</span>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((r) => (
        <div key={r.k} className="stack" style={{ gap: 4 }}>
          <div className="row small" style={{ justifyContent: 'space-between' }}><span>{r.k}</span><span className="muted">{money ? usd(r.v) : num(r.v)}{r.n !== undefined ? ` · ${r.n}×` : ''}</span></div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--track)' }}><div style={{ height: 6, borderRadius: 3, width: `${pct(Math.max(0, r.v), total)}%`, background: 'var(--gold)' }} /></div>
        </div>
      ))}
    </div>
  );
}

const Panel = ({ title, href, children, flex = '1 1 320px' }: { title: string; href?: string; children: React.ReactNode; flex?: string }) => (
  <section className="card stack" style={{ flex, gap: 14 }}>
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h2>
      {href && <Link href={href} className="small">Open</Link>}
    </div>
    {children}
  </section>
);

export default async function Overview({ searchParams }: { searchParams: Promise<{ d?: string; test?: string }> }) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.d)) ? Number(sp.d) : 30;
  const test = sp.test === '1';
  const supabase = await supabaseServer();
  const [{ data: cc, error }, { data: bands }, { data: an }] = await Promise.all([
    supabase.rpc('staff_command_center', { p_days: days, p_include_test: test }),
    supabase.from('profiles').select('band').not('band', 'is', null),
    supabase.rpc('staff_analytics', { p_days: Math.min(days, 30) }),
  ]);
  const c: any = cc || {};
  const r = c.revenue || {}, s = c.subs || {}, g = c.growth || {}, e = c.engagement || {}, saf = c.safety || {}, sup = c.support || {};
  const totalBands = bands?.length || 0;
  const share = (b: Band) => (totalBands ? Math.round(((bands || []).filter((x) => x.band === b).length / totalBands) * 100) : 0);
  const qs = (o: Record<string, string | number>) => '?' + new URLSearchParams({ d: String(days), ...(test ? { test: '1' } : {}), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) }).toString();

  const attention = [
    { n: saf.open_reports, label: 'Open reports', href: '/admin/moderation', alert: true },
    { n: sup.high, label: 'Urgent support (billing or safety)', href: '/admin/support', alert: true },
    { n: sup.open, label: 'Open support tickets' + (sup.oldest_hours ? ` · oldest ${sup.oldest_hours}h` : ''), href: '/admin/support' },
    { n: saf.verification_queue, label: 'ID or photo reviews', href: '/admin/verification' },
    { n: (saf.repeat_reported || []).length, label: 'Members with 2+ open reports', href: '/admin/moderation', alert: true },
    { n: s.billing_issues, label: `Billing issues (${days}d)`, href: '/admin/billing' },
    { n: c.email?.failed, label: `Emails failed (${days}d)`, href: '/admin/emails' },
    { n: saf.deletions_pending, label: 'Deletion requests', href: '/admin/deletions' },
  ].filter((a) => Number(a.n) > 0);

  const funnel: [string, number][] = [['Joined waitlist', g.waitlist_joins], ['Signed up', g.signups], ['ID verified', g.id_verified], ['Band verified', g.band_verified], ['Paying', g.paying]];
  const funnelMax = Math.max(1, ...funnel.map(([, v]) => Number(v) || 0));
  const plans = Object.entries((s.by_plan || {}) as Record<string, number>).filter(([k]) => k !== 'none').sort((a, b) => b[1] - a[1]);
  const gender = (e.gender || {}) as Record<string, number>;
  const gTotal = Object.values(gender).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}><span className="label">New York · Command center</span><h1 className="serif" style={{ fontSize: 44, margin: 0 }}>Overview</h1></div>
        <div className="row small" style={{ gap: 6, flexWrap: 'wrap' }}>
          {[7, 30, 90].map((d) => <Link key={d} href={qs({ d })} className={d === days ? 'btn sm' : 'btn ghost sm'}>{d} days</Link>)}
          <Link href={'?' + new URLSearchParams({ d: String(days), ...(test ? {} : { test: '1' }) }).toString()} className="btn ghost sm">{test ? 'Hide test accounts' : 'Include test accounts'}</Link>
        </div>
      </div>
      {error && <div className="notice error">Run migration 0014 in Supabase to turn on the command center. ({error.message})</div>}
      {test && <div className="notice small">Showing demo/test accounts too. Turn this off for real numbers.</div>}

      {/* Needs attention */}
      <section className="card stack" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>Needs attention</h2>
        {attention.length === 0 && <span className="small muted">All clear. Nothing waiting on the team.</span>}
        {attention.map((a) => (
          <Link key={a.label} href={a.href} className="list-row">
            <span className="serif" style={{ fontSize: 26, minWidth: 48, color: a.alert ? 'var(--alert)' : 'var(--gold-light)' }}>{num(a.n)}</span>
            <span className="grow">{a.label}</span><span className="small">Open</span>
          </Link>
        ))}
      </section>

      {/* Money */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        <Tile label={`Gross revenue (${days}d)`} value={usd(r.gross)} sub={`${num(r.transactions)} purchases`} href="/admin/billing" />
        <Tile label="Net after store fees" value={usd(r.net_after_fees)} sub="What Apple/Google pay out" />
        <Tile label="MRR (estimate)" value={usd(r.mrr_estimate)} sub="Active plans × list price" />
        <Tile label={`Refunds (${days}d)`} value={usd(r.refunds)} alert={Number(r.refunds) > 0} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Panel title="Revenue by day" flex="2 1 420px"><Bars data={r.daily || []} money /></Panel>
        <Panel title="By store"><Split money rows={(r.by_store || []).map((x: KV) => ({ ...x, k: STORE[x.k] || x.k }))} /></Panel>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Panel title="By product"><Split money rows={r.by_product || []} /></Panel>
        <Panel title="Latest transactions" href="/admin/billing" flex="2 1 420px">
          {(r.recent || []).length === 0 && <span className="small muted">No purchases yet. Revenue appears here as soon as RevenueCat sends its first event.</span>}
          {(r.recent || []).map((t: any, i: number) => (
            <div key={i} className="row small" style={{ gap: 10 }}>
              <span className="grow">{t.user_id ? <Link href={`/admin/members/${t.user_id}`}>{t.name || 'Member'}</Link> : 'Member'} · <span className="muted">{t.product}</span></span>
              <span className="muted">{STORE[t.store] || t.store}</span>
              <span style={{ color: Number(t.price) < 0 ? 'var(--alert)' : undefined, minWidth: 70, textAlign: 'right' }}>{usd(t.price, true)}</span>
            </div>
          ))}
        </Panel>
      </div>

      {/* Subscribers + growth */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Panel title="Subscribers" href="/admin/members">
          {plans.length === 0 && <span className="small muted">No paying members yet.</span>}
          {plans.map(([k, v]) => <div key={k} className="row small" style={{ justifyContent: 'space-between' }}><span>{PLAN_NAME(k)}</span><strong>{num(v)}</strong></div>)}
          <div className="row small muted" style={{ gap: 14, flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
            <span>New {num(s.new)}</span><span>Renewed {num(s.renewals)}</span><span>Cancelled {num(s.cancellations)}</span><span>Expired {num(s.expirations)}</span>
          </div>
        </Panel>
        <Panel title={`Funnel (${days}d)`} href="/admin/analytics" flex="2 1 420px">
          {funnel.map(([l, v], i) => (
            <div key={l} className="stack" style={{ gap: 4 }}>
              <div className="row small" style={{ justifyContent: 'space-between' }}><span>{l}</span><span className="muted">{num(v)}{i > 0 ? ` · ${pct(v, funnel[i - 1][1])}% of previous` : ''}</span></div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--track)' }}><div style={{ height: 8, borderRadius: 4, width: `${pct(v, funnelMax)}%`, background: 'var(--gold)' }} /></div>
            </div>
          ))}
          <span className="small muted">{num(g.waitlist_waiting)} still waiting for an invite.</span>
        </Panel>
      </div>

      {/* Engagement */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <Tile label="Active today" value={num(e.dau)} sub={`${num(e.wau)} this week · ${num(e.mau)} this month`} />
        <Tile label="Stickiness" value={`${pct(e.dau, e.mau)}%`} sub="Daily ÷ monthly actives" />
        <Tile label={`New chats (${days}d)`} value={num(e.conversations)} sub={`${num(e.messages)} messages`} />
        <Tile label="Reply rate" value={e.reply_rate == null ? '—' : `${e.reply_rate}%`} sub="Chats where both people wrote" />
        <Tile label={`Dates (${days}d)`} value={num(e.dates_accepted)} sub={`${num(e.dates_proposed)} proposed`} />
        <Tile label="Push devices" value={num(e.push_devices)} sub={`${num(e.rsvps)} event RSVPs`} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Panel title={`Most popular profiles (${days}d)`} flex="2 1 420px">
          {(c.popular || []).length === 0 && <span className="small muted">No conversations yet in this period.</span>}
          {(c.popular || []).map((p: any, i: number) => (
            <Link key={p.id} href={`/admin/members/${p.id}`} className="row small" style={{ gap: 10, textDecoration: 'none', color: 'inherit' }}>
              <span className="mono muted" style={{ width: 18 }}>{i + 1}</span>
              <span className="grow"><strong>{p.name || 'Member'}</strong> <span className="muted">· {p.neighborhood || '—'} · {PLAN_NAME(p.plan)}</span></span>
              {p.band && <span style={{ color: BANDS[p.band as Band]?.color }}>{BANDS[p.band as Band]?.label}</span>}
              <span style={{ minWidth: 120, textAlign: 'right' }}>{num(p.hellos)} hellos · {pct(p.replies, p.hellos)}% replied</span>
            </Link>
          ))}
          <span className="small muted">Staff only. Use it to spot standout profiles for features, and to sanity-check anyone who looks too popular.</span>
        </Panel>
        <Panel title="Members by band">
          {(Object.keys(BANDS) as Band[]).map((b) => (
            <div key={b} className="stack" style={{ gap: 6 }}>
              <div className="row small" style={{ justifyContent: 'space-between' }}><span style={{ color: BANDS[b].color }}>{BANDS[b].label}</span><span className="muted">{share(b)}%</span></div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--track)' }}><div style={{ height: 8, borderRadius: 4, width: `${share(b)}%`, background: BANDS[b].color }} /></div>
            </div>
          ))}
          <span className="small muted">Bands only. Exact scores are never stored.</span>
        </Panel>
        <Panel title="Members by gender">
          {gTotal === 0 ? <span className="small muted">No active members yet.</span> : GENDERS.filter(([k]) => k !== 'unset' || gender.unset).map(([k, label, color]) => (
            <div key={k} className="stack" style={{ gap: 6 }}>
              <div className="row small" style={{ justifyContent: 'space-between' }}><span>{label}</span><span className="muted">{pct(gender[k] || 0, gTotal)}% · {num(gender[k])}</span></div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--track)' }}><div style={{ height: 8, borderRadius: 4, width: `${pct(gender[k] || 0, gTotal)}%`, background: color }} /></div>
            </div>
          ))}
          <span className="small muted">Active and preview members{test ? ', including test accounts' : ''}. {num(gTotal)} total.</span>
        </Panel>
      </div>

      {/* Safety + support */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Panel title="Trust & safety" href="/admin/moderation">
          <div className="row small muted" style={{ gap: 14, flexWrap: 'wrap' }}>
            <span>Reports ({days}d) {num(saf.reports_period)}</span><span>Blocks {num(saf.blocks_period)}</span><span>Suspended {num(saf.suspended)}</span>
          </div>
          {(saf.repeat_reported || []).map((m: any) => (
            <Link key={m.id} href={`/admin/members/${m.id}`} className="row small" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="grow">{m.name || 'Member'}</span><span style={{ color: 'var(--alert)' }}>{m.n} open reports</span>
            </Link>
          ))}
          {(saf.repeat_reported || []).length === 0 && <span className="small muted">No repeat-reported members.</span>}
        </Panel>
        <Panel title="Customer support" href="/admin/support">
          <div className="row small muted" style={{ gap: 14, flexWrap: 'wrap' }}>
            <span>Open {num(sup.open)}</span><span>In progress {num(sup.pending)}</span><span>Resolved ({days}d) {num(sup.resolved_period)}</span>
          </div>
          {(sup.latest || []).map((t: any) => (
            <Link key={t.id} href="/admin/support" className="row small" style={{ textDecoration: 'none', color: 'inherit', gap: 8 }}>
              <span className="grow">{t.subject}</span>
              <span className="muted">{t.category}</span>
              {t.priority === 'high' && <span style={{ color: 'var(--alert)' }}>high</span>}
            </Link>
          ))}
          {(sup.latest || []).length === 0 && <span className="small muted">No open tickets.</span>}
        </Panel>
        {an && (
          <Panel title="Website (traffic)" href="/admin/analytics">
            <div className="row small" style={{ justifyContent: 'space-between' }}><span>Visitors</span><strong>{num(an.visitors)}</strong></div>
            <div className="row small" style={{ justifyContent: 'space-between' }}><span>Sessions</span><strong>{num(an.sessions)}</strong></div>
            <div className="row small" style={{ justifyContent: 'space-between' }}><span>Top source</span><strong>{(an.sources?.[0]?.k as string) || '—'}</strong></div>
            <div className="row small" style={{ justifyContent: 'space-between' }}><span>Emails sent ({days}d)</span><strong>{num(c.email?.sent)}</strong></div>
          </Panel>
        )}
      </div>
    </>
  );
}
