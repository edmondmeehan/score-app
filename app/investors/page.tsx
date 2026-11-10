import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Logo } from '@/components/ui';
import { supabaseAnon } from '@/lib/supabase/server';
import { INVESTOR_COOKIE, cells, lines, mergeContent, sha256 } from '@/lib/investors';
import { computeModel, mergeAssumptions, pctf, usd, type Assumptions, type Row } from '@/lib/investorModel';
import { PLANS } from '@/lib/types';
import { investorLogin, investorLogout } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Investors · ScoreDate', robots: { index: false, follow: false, nocache: true } };

type Live = { waitlist: number; waitlist_30d: number; referred: number; founders: number; members: number; by_area: { area: string; n: number }[]; as_of: string };
type Room = { content: unknown; model: unknown; live: Live; viewer: string | null };

const ERR: Record<string, string> = {
  missing: 'Enter your name and the password.',
  wrong: 'That password isn’t right. Check with the ScoreDate team.',
  locked: 'Too many tries. Please wait 15 minutes and try again.',
  closed: 'The investor room isn’t open yet.',
  setup: 'The investor room is being set up. Please try again soon.',
};

export default async function Investors({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  const token = (await cookies()).get(INVESTOR_COOKIE)?.value;
  let room: Room | null = null;
  if (token) {
    const { data } = await supabaseAnon().rpc('investor_room', { p_token_hash: sha256(token) });
    room = (data as Room) || null;
  }
  if (!room) return <Gate error={sp.e ? ERR[sp.e] || ERR.wrong : null} />;
  return <RoomView room={room} />;
}

function Gate({ error }: { error: string | null }) {
  return (
    <main className="page stack" style={{ maxWidth: 420, padding: '12vh 20px 80px', gap: 20 }}>
      <Link href="/" aria-label="ScoreDate home" style={{ color: 'inherit', textDecoration: 'none' }}><Logo /></Link>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Investors</span>
        <h1 className="serif" style={{ fontSize: 40, margin: 0 }}>Investor room</h1>
        <span className="muted small">Private and confidential. Enter the password the ScoreDate team shared with you.</span>
      </div>
      {error && <div className="notice error">{error}</div>}
      <form action={investorLogin} className="card stack" style={{ gap: 12 }}>
        <label className="field">Your name<input className="input" name="name" autoComplete="name" maxLength={80} required /></label>
        <label className="field">Password<input className="input" name="password" type="password" autoComplete="current-password" required /></label>
        <button className="btn block">Enter</button>
      </form>
      <span className="small muted">Your name and the time you visit are recorded so we know who has seen these materials.</span>
    </main>
  );
}

const TOC = [['overview', 'Overview'], ['product', 'Product'], ['traction', 'Live demand'], ['market', 'Market report'], ['model', 'Business model'], ['growth', 'Growth plan'], ['pnl', 'Sample P&L'], ['unit', 'Unit economics'], ['trust', 'Trust & compliance'], ['team', 'Team'], ['raise', 'The raise']] as const;

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="stack" style={{ gap: 16, scrollMarginTop: 80, paddingTop: 8 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="label">{eyebrow}</span>
        <h2 className="serif" style={{ fontSize: 34, margin: 0, lineHeight: 1.1 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Stat({ n, label, sub }: { n: string; label: string; sub?: string }) {
  return (
    <div className="card stack" style={{ gap: 4, flex: '1 1 160px' }}>
      <span className="serif" style={{ fontSize: 34, lineHeight: 1 }}>{n}</span>
      <span className="small">{label}</span>
      {sub && <span className="small muted">{sub}</span>}
    </div>
  );
}

const Bullets = ({ text }: { text: string }) => (
  <ul className="stack" style={{ gap: 8, margin: 0, paddingLeft: 18 }}>{lines(text).map((l) => <li key={l} style={{ lineHeight: 1.55 }}>{l}</li>)}</ul>
);
const P = ({ children }: { children: React.ReactNode }) => <p style={{ margin: 0, lineHeight: 1.65, color: 'var(--stone)', maxWidth: 760 }}>{children}</p>;

function RoomView({ room }: { room: Room }) {
  const c = mergeContent(room.content);
  const a = mergeAssumptions(room.model);
  const rows = computeModel(a);
  const live = room.live;
  const last = rows[rows.length - 1];
  const breakeven = rows.find((r) => r.ebitda > 0);
  const trough = Math.min(0, ...rows.map((r) => r.cumulative));
  const num = (v: number) => Math.round(v).toLocaleString('en-US');

  return (
    <div>
      <header className="site-header" style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--appbar)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="page row" style={{ justifyContent: 'space-between', padding: '14px 20px', gap: 12 }}>
          <span className="row" style={{ gap: 10 }}><Logo size={15} /><span className="label" style={{ color: 'var(--gold)' }}>Investor room</span></span>
          <form action={investorLogout}><button className="btn ghost sm">Sign out</button></form>
        </div>
      </header>

      <div className="page doc-wrap" style={{ paddingTop: 32 }}>
        <nav className="doc-toc" aria-label="Sections">
          <span className="label" style={{ marginBottom: 4 }}>Contents</span>
          {TOC.map(([id, h]) => <a key={id} href={`#${id}`}>{h}</a>)}
        </nav>
        <main className="doc-body stack" style={{ gap: 56, maxWidth: 'none', minWidth: 0, paddingBottom: 80 }}>
          <details className="doc-toc-mobile"><summary>Contents</summary><nav>{TOC.map(([id, h]) => <a key={id} href={`#${id}`}>{h}</a>)}</nav></details>

          <Section id="overview" eyebrow="Overview" title={c.headline}>
            <P>{c.summary}</P>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <Stat n={num(live.waitlist)} label="On the waitlist" sub="Live count" />
              <Stat n={a.markets.length.toString()} label="Markets in the plan" sub={`${a.markets.filter((m) => m.launch === 1).map((m) => m.name).join(' + ')} first`} />
              <Stat n={usd(last.net)} label={`Net revenue, year ${last.year}`} sub="Illustrative model" />
              <Stat n={breakeven ? `Year ${breakeven.year}` : 'Beyond plan'} label="EBITDA positive" sub="Illustrative model" />
            </div>
            <div className="row" style={{ gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div className="stack grow" style={{ gap: 8, flex: '1 1 300px' }}><strong>The problem</strong><P>{c.problem}</P></div>
              <div className="stack grow" style={{ gap: 8, flex: '1 1 300px' }}><strong>Our answer</strong><P>{c.solution}</P></div>
            </div>
          </Section>

          <Section id="product" eyebrow="Product" title="How ScoreDate works">
            <ol className="stack" style={{ gap: 10, margin: 0, paddingLeft: 20 }}>{lines(c.how).map((l) => <li key={l} style={{ lineHeight: 1.55 }}>{l}</li>)}</ol>
            <div className="row" style={{ gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div className="card stack" style={{ gap: 8, flex: '1 1 300px' }}><strong>Why now</strong><P>{c.why_now}</P></div>
              <div className="card stack" style={{ gap: 8, flex: '1 1 300px' }}><strong>What makes it defensible</strong><Bullets text={c.moat} /></div>
            </div>
            <span className="small muted">Also in the product: invite codes, the Daily Drop, Notes, member search, in-chat date planning with safety check-ins, member events, Discover (tips, news, partner perks) and Founding Member perks. Web app live now; iPhone and Android apps use in-app billing through RevenueCat.</span>
          </Section>

          <Section id="traction" eyebrow="Live demand" title="Waitlist, updated in real time">
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <Stat n={num(live.waitlist)} label="Total waitlist" />
              <Stat n={num(live.waitlist_30d)} label="Joined in the last 30 days" />
              <Stat n={num(live.referred)} label="Joined through a friend’s link" sub={live.waitlist ? `${pctf(live.referred / live.waitlist)} of the waitlist` : undefined} />
              <Stat n={num(live.founders)} label="Founding Members" />
            </div>
            {live.by_area.length > 0 && (
              <div className="card stack" style={{ gap: 10 }}>
                <strong>Where demand is coming from</strong>
                {live.by_area.slice(0, 8).map((r) => (
                  <div key={r.area} className="stack" style={{ gap: 4 }}>
                    <div className="row small" style={{ justifyContent: 'space-between' }}><span>{r.area}</span><span className="muted">{num(r.n)}</span></div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--track)' }}><div style={{ height: 8, borderRadius: 4, width: `${live.waitlist ? (r.n / live.waitlist) * 100 : 0}%`, background: 'var(--gold)' }} /></div>
                  </div>
                ))}
              </div>
            )}
            <span className="small muted">Counts exclude test accounts. The waitlist is demand, not paying members. As of {new Date(live.as_of).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET.</span>
          </Section>

          <Section id="market" eyebrow="Market report" title="Dating apps and financial compatibility">
            <p className="muted" style={{ margin: 0 }}>Our research on the dating app market, its growth through 2030, how money drives breakups, and why credit is a trusted signal of responsibility, with sources and revenue scenarios.</p>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <Stat n="$8.9B" label="Global dating app revenue by 2030" sub="From $6B+ in 2024 (Business of Apps)" />
              <Stat n="2–3x" label="More likely to split" sub="Couples with the lowest credit scores (Federal Reserve)" />
              <Stat n="$34M" label="Base-case annual revenue, Year 5" sub="100k paying members. Illustrative, not a forecast" />
            </div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <a href="/investors/market-report" className="btn">Read the report</a>
              <a href="/investors/market-report?download=1" className="btn ghost">Download PDF</a>
            </div>
          </Section>

          <Section id="model" eyebrow="Business model" title="Paid membership, priced for a premium audience">
            <div style={{ overflowX: 'auto' }}>
              <table className="inv-table">
                <thead><tr><th>Plan</th><th>Price</th><th>What members get</th><th>Model mix</th></tr></thead>
                <tbody>
                  <tr><td>Preview</td><td>$9.99 once</td><td>Verification, a look at 5 matches</td><td>—</td></tr>
                  <tr><td>{PLANS.membership.name}</td><td>{PLANS.membership.monthly}<br /><span className="muted small">{PLANS.membership.annual}</span></td><td>{PLANS.membership.perks}</td><td>{pctf(a.mix.membership)}</td></tr>
                  <tr><td>{PLANS.premium.name}</td><td>{PLANS.premium.monthly}<br /><span className="muted small">{PLANS.premium.annual}</span></td><td>{PLANS.premium.perks}</td><td>{pctf(a.mix.premium)}</td></tr>
                  <tr><td>{PLANS.black.name}</td><td>{PLANS.black.monthly}</td><td>{PLANS.black.perks}</td><td>{pctf(a.mix.reserve)}</td></tr>
                  <tr><td>Paused / Taken</td><td>$4.99/mo</td><td>Stay hidden without losing your account</td><td>{pctf(a.paused_share)} of members</td></tr>
                  <tr><td>Add-ons</td><td>from $1.99</td><td>Notes, featured placement, extra connections</td><td>{usd(a.addon_pm, false)}/member/mo</td></tr>
                </tbody>
              </table>
            </div>
            <span className="small muted">Plus member events and brand partnerships in each market from its second year. Subscriptions are billed in-app through Apple and Google.</span>
          </Section>

          <Section id="growth" eyebrow="Growth plan" title="Market by market, led by demand">
            <P>We open one region at a time and only release invites in an area once its waitlist is ready, so every launch starts with a full room. New York City and the Hamptons come first, then Connecticut and Boston, then Los Angeles and San Francisco. After that, the next markets are chosen by where the waitlist grows fastest.</P>
            <Timeline a={a} />
          </Section>

          <Section id="pnl" eyebrow="Financials" title="Sample growth P&L">
            <div className="notice test">Illustrative model built from the assumptions below. It is not a forecast and not actual results.</div>
            <Chart rows={rows} />
            <PnL rows={rows} />
            <Assumptions a={a} />
          </Section>

          <Section id="unit" eyebrow="Unit economics" title="What a member is worth">
            <UnitEconomics a={a} rows={rows} />
            <span className="small muted">Peak cumulative investment in the model: {usd(-trough)} before cash flow turns positive.</span>
          </Section>

          <Section id="trust" eyebrow="Trust & compliance" title="Built on privacy and verification">
            <Bullets text={c.trust} />
          </Section>

          <Section id="team" eyebrow="Team" title="Who’s building ScoreDate">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {cells(c.team).map((t) => (
                <div key={t.a} className="card stack" style={{ gap: 6 }}>
                  <strong>{t.a}</strong>
                  {t.b && <span className="small" style={{ color: 'var(--gold)' }}>{t.b}</span>}
                  {t.c && <span className="small muted" style={{ lineHeight: 1.55 }}>{t.c}</span>}
                </div>
              ))}
            </div>
          </Section>

          <Section id="raise" eyebrow="The raise" title="Investment opportunity">
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <Stat n={c.raise_amount} label="Raising" />
              <Stat n={c.raise_instrument} label="Instrument" />
            </div>
            {c.raise_terms && <P>{c.raise_terms}</P>}
            <div className="row" style={{ gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div className="card stack" style={{ gap: 10, flex: '1 1 300px' }}>
                <strong>Use of funds</strong>
                {cells(c.raise_use).map((u) => {
                  const pct = Math.max(0, Math.min(100, Number(u.b) || 0));
                  return (
                    <div key={u.a} className="stack" style={{ gap: 4 }}>
                      <div className="row small" style={{ justifyContent: 'space-between' }}><span>{u.a}</span><span className="muted">{u.b ? `${pct}%` : ''}</span></div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--track)' }}><div style={{ height: 8, borderRadius: 4, width: `${pct}%`, background: 'var(--gold)' }} /></div>
                    </div>
                  );
                })}
              </div>
              <div className="card stack" style={{ gap: 8, flex: '1 1 300px' }}><strong>Milestones this round funds</strong><Bullets text={c.raise_milestones} /></div>
            </div>
            <div className="card row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <span>Questions or next steps? <strong>{c.contact_name}</strong></span>
              <a className="btn sm" href={`mailto:${c.contact_email}?subject=${encodeURIComponent('ScoreDate investor inquiry')}`}>{c.contact_email}</a>
            </div>
          </Section>

          <p className="small muted" style={{ lineHeight: 1.6, borderTop: '1px solid var(--line-soft)', paddingTop: 20, margin: 0 }}>{c.disclaimer}</p>
        </main>
      </div>
    </div>
  );
}

function Timeline({ a }: { a: Assumptions }) {
  const years = Array.from({ length: a.years }, (_, i) => i + 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(170px, 1fr))`, gap: 12 }}>
      {years.map((y) => {
        const ms = a.markets.filter((m) => m.launch === y);
        return (
          <div key={y} className="card stack" style={{ gap: 8, borderColor: ms.length ? 'var(--gold-edge, var(--line-soft))' : undefined, opacity: ms.length ? 1 : 0.6 }}>
            <span className="label">Year {y}</span>
            {ms.length ? ms.map((m) => (
              <div key={m.name} className="stack" style={{ gap: 2 }}>
                <strong>{m.name}</strong>
                <span className="small muted">{m.target.toLocaleString('en-US')} members at maturity</span>
              </div>
            )) : <span className="small muted">Deepen existing markets</span>}
          </div>
        );
      })}
    </div>
  );
}

function Chart({ rows }: { rows: Row[] }) {
  const W = 640, H = 220, pad = 28;
  const max = Math.max(1, ...rows.map((r) => r.net));
  const min = Math.min(0, ...rows.map((r) => r.ebitda));
  const span = max - min || 1;
  const y = (v: number) => pad + ((max - v) / span) * (H - pad * 2);
  const bw = (W - pad * 2) / rows.length;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row small" style={{ gap: 16, marginBottom: 8 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--gold)', marginRight: 6 }} />Net revenue</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--rise)', marginRight: 6 }} />EBITDA</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Net revenue and EBITDA by year">
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="var(--line-soft)" />
        {rows.map((r, i) => {
          const x = pad + i * bw;
          const e0 = y(Math.max(0, r.ebitda)), e1 = y(Math.min(0, r.ebitda));
          return (
            <g key={r.year}>
              <rect x={x + bw * 0.14} y={y(r.net)} width={bw * 0.34} height={Math.max(1, y(0) - y(r.net))} rx={3} fill="var(--gold)" />
              <rect x={x + bw * 0.52} y={e0} width={bw * 0.34} height={Math.max(1, e1 - e0)} rx={3} fill={r.ebitda >= 0 ? 'var(--rise)' : 'var(--alert)'} />
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--muted)">Y{r.year}</text>
              <text x={x + bw * 0.31} y={y(r.net) - 5} textAnchor="middle" fontSize="11" fill="var(--stone)">{usd(r.net)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PnL({ rows }: { rows: Row[] }) {
  const R = ({ label, k, bold, neg, pct }: { label: string; k: keyof Row; bold?: boolean; neg?: boolean; pct?: boolean }) => (
    <tr className={bold ? 'inv-strong' : undefined}>
      <td>{label}</td>
      {rows.map((r) => {
        const v = r[k] as number;
        return <td key={r.year} className="num" style={v < 0 ? { color: 'var(--alert)' } : undefined}>{pct ? pctf(v) : k === 'members' || k === 'newMembers' || k === 'markets' ? Math.round(v).toLocaleString('en-US') : (neg ? '(' + usd(v) + ')' : usd(v))}</td>;
      })}
    </tr>
  );
  const H = ({ t }: { t: string }) => <tr className="inv-head"><td colSpan={rows.length + 1}>{t}</td></tr>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="inv-table">
        <thead><tr><th />{rows.map((r) => <th key={r.year} className="num">Year {r.year}</th>)}</tr></thead>
        <tbody>
          <H t="Members" />
          <R label="Markets live" k="markets" />
          <R label="Paying members (year end)" k="members" bold />
          <R label="New members in year" k="newMembers" />
          <H t="Revenue" />
          <R label="Subscriptions" k="subs" />
          <R label="Add-ons" k="addons" />
          <R label="Paused / Taken" k="paused" />
          <R label="Preview ($9.99)" k="preview" />
          <R label="Events & partnerships" k="events" />
          <R label="Gross revenue" k="gross" bold />
          <R label="App store fees" k="storeFees" neg />
          <R label="Net revenue" k="net" bold />
          <H t="Cost of revenue" />
          <R label="Verification & credit checks" k="verify" neg />
          <R label="Hosting & tools" k="infra" neg />
          <R label="Event costs" k="eventsCost" neg />
          <R label="Gross profit" k="grossProfit" bold />
          <R label="Gross margin" k="grossMargin" pct />
          <H t="Operating expenses" />
          <R label="Marketing & launches" k="marketing" neg />
          <R label="Team" k="payroll" neg />
          <R label="General & admin" k="ga" neg />
          <R label="EBITDA" k="ebitda" bold />
          <R label="EBITDA margin" k="ebitdaMargin" pct />
          <R label="Cumulative EBITDA" k="cumulative" />
        </tbody>
      </table>
    </div>
  );
}

function Assumptions({ a }: { a: Assumptions }) {
  const items: [string, string][] = [
    ['Ramp to market maturity', a.ramp.map((r, i) => `Y${i + 1} ${pctf(r)}`).join(' · ')],
    ['Plan mix', `Membership ${pctf(a.mix.membership)} · Premium ${pctf(a.mix.premium)} · Reserve ${pctf(a.mix.reserve)}`],
    ['Average discount (annual plans, offers)', pctf(a.discount)],
    ['Monthly churn', pctf(a.churn_m)],
    ['Previews bought per new member', String(a.previews_per_member)],
    ['App store fee', pctf(a.store_fee)],
    ['Verification + credit check per applicant', usd(a.verify_cost, false)],
    ['Marketing cost per new member', usd(a.cac, false)],
    ['Launch budget per new market', usd(a.launch_budget)],
    ['Events & partnerships per market / year', usd(a.events_per_market)],
    ['Team cost by year', a.payroll.map((p, i) => `Y${i + 1} ${usd(p)}`).join(' · ')],
    ['G&A', `${pctf(a.ga_pct)} of net revenue (min ${usd(a.ga_min)})`],
  ];
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer' }}><strong>Model assumptions</strong></summary>
      <div className="stack" style={{ gap: 8, marginTop: 12 }}>
        {items.map(([k, v]) => <div key={k} className="row small" style={{ justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--line-soft)', paddingBottom: 6 }}><span className="muted">{k}</span><span>{v}</span></div>)}
        <span className="small muted">Markets: {a.markets.map((m) => `${m.name} (Y${m.launch}, ${m.target.toLocaleString('en-US')})`).join(' · ')}</span>
      </div>
    </details>
  );
}

function UnitEconomics({ a, rows }: { a: Assumptions; rows: Row[] }) {
  const arpu = rows.reduce((s, r) => s + r.arpu, 0) / rows.length;
  const life = a.churn_m > 0 ? 1 / a.churn_m : 0;
  const gm = rows[rows.length - 1].grossMargin;
  const ltv = arpu * gm * life;
  const cac = a.cac + a.previews_per_member * a.verify_cost;
  return (
    <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
      <Stat n={usd(arpu, false)} label="Net revenue per member / month" sub="After app store fees" />
      <Stat n={`${life.toFixed(0)} mo`} label="Average membership" sub={`At ${pctf(a.churn_m)} monthly churn`} />
      <Stat n={usd(ltv, false)} label="Lifetime gross profit per member" />
      <Stat n={usd(cac, false)} label="Cost to acquire a member" sub="Marketing + verification" />
      <Stat n={`${cac ? (ltv / cac).toFixed(1) : '—'}×`} label="LTV to CAC" />
    </div>
  );
}
