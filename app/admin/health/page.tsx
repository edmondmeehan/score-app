import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { getHealth, PERIODS, type Health, type PeriodKey } from '@/lib/vercelObservability';

export const dynamic = 'force-dynamic';

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
const bytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a / b < 0.01 && a > 0 ? 2 : 1)}%` : '0%');

function Tile({ n, label, sub, tone }: { n: string; label: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card stack" style={{ gap: 4, flex: '1 1 150px' }}>
      <span className="serif" style={{ fontSize: 30, lineHeight: 1, color: tone === 'bad' ? 'var(--alert)' : tone === 'good' ? 'var(--rise)' : undefined }}>{n}</span>
      <span className="small">{label}</span>
      {sub && <span className="small muted">{sub}</span>}
    </div>
  );
}

function Bars({ rows, total, color = 'var(--gold)' }: { rows: { k: string; n: number; c?: string }[]; total: number; color?: string }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((r) => (
        <div key={r.k} className="stack" style={{ gap: 4 }}>
          <div className="row small" style={{ justifyContent: 'space-between', gap: 12 }}><span className="mono" style={{ overflowWrap: 'anywhere' }}>{r.k}</span><span className="muted" style={{ whiteSpace: 'nowrap' }}>{num(r.n)} · {pct(r.n, total)}</span></div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--track)' }}><div style={{ height: 6, borderRadius: 3, width: `${total ? Math.max(1, (r.n / total) * 100) : 0}%`, background: r.c || color }} /></div>
        </div>
      ))}
    </div>
  );
}

function Spark({ h, period }: { h: Health; period: PeriodKey }) {
  const W = 720, H = 140, pad = 6;
  const pts = h.series;
  const max = Math.max(1, ...pts.map((p) => p.n));
  const bw = pts.length ? (W - pad * 2) / pts.length : 0;
  const fmt = (t: string) => new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', ...(period === '7d' ? { weekday: 'short' } : { hour: 'numeric', minute: '2-digit' }) });
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row small" style={{ justifyContent: 'space-between' }}><strong>Requests</strong><span className="muted">peak {num(max)} per bucket</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" role="img" aria-label="Requests over time" style={{ height: 140 }}>
        {pts.map((p, i) => {
          const bh = (p.n / max) * (H - pad * 2);
          return <rect key={p.t} x={pad + i * bw + 1} y={H - pad - bh} width={Math.max(1, bw - 2)} height={Math.max(p.n ? 2 : 0, bh)} rx={2} fill="var(--gold)"><title>{`${fmt(p.t)}: ${num(p.n)}`}</title></rect>;
        })}
      </svg>
      {pts.length > 1 && <div className="row small muted" style={{ justifyContent: 'space-between' }}><span>{fmt(pts[0].t)}</span><span>{fmt(pts[pts.length - 1].t)} ET</span></div>}
    </div>
  );
}

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const period = (sp.p && sp.p in PERIODS ? sp.p : '24h') as PeriodKey;
  const h = await getHealth(period);
  const errRate = h.total ? h.classes['5xx'] / h.total : 0;
  const statusColor = (c: string) => (c.startsWith('5') ? 'var(--alert)' : c.startsWith('4') ? 'var(--gold-light)' : c.startsWith('3') ? 'var(--stone)' : 'var(--rise)');

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 className="serif" style={{ fontSize: 44 }}>Site health</h1>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
            <Link key={k} href={`/admin/health?p=${k}`} className={k === period ? 'btn sm' : 'btn ghost sm'}>{PERIODS[k].label}</Link>
          ))}
        </div>
      </div>
      <span className="small muted">Live traffic and performance from Vercel for scoredate.app. Refresh the page for the latest numbers. <a href={`https://vercel.com/pleaseco/score-app/observability?period=${period}`} target="_blank" rel="noopener noreferrer">Open in Vercel ↗</a></span>

      {!h.configured && <div className="notice error">This page uses the same VERCEL_API_TOKEN as the Security page. It’s set for Production only, so it works on scoredate.app but not on preview links.</div>}
      {h.error && <div className="notice error">Couldn’t load Vercel data: {h.error}. If it says 403, the token may need access to this team’s observability.</div>}

      {h.configured && !h.error && (
        <>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <Tile n={num(h.total)} label="Requests" sub={`Last ${PERIODS[period].label}`} />
            <Tile n={pct(h.classes['5xx'], h.total)} label="Server errors (5xx)" sub={`${num(h.classes['5xx'])} requests`} tone={errRate > 0.01 ? 'bad' : 'good'} />
            <Tile n={num(h.classes['4xx'])} label="Not found / denied (4xx)" sub={pct(h.classes['4xx'], h.total)} />
            <Tile n={ms(h.fnP75)} label="Server response (p75)" sub={`p95 ${ms(h.fnP95)} · ${num(h.fnCount)} function runs`} tone={h.fnP75 > 1500 ? 'bad' : undefined} />
            <Tile n={ms(h.ttfbP75)} label="Time to first byte (p75)" />
            <Tile n={bytes(h.bytes)} label="Data transferred" />
          </div>

          <Spark h={h} period={period} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <section className="card stack" style={{ gap: 12 }}>
              <strong>Server errors by page</strong>
              {h.errors.length === 0
                ? <span className="small" style={{ color: 'var(--rise)' }}>No server errors in this period.</span>
                : <Bars rows={h.errors.map((e) => ({ k: `${e.code} ${e.path}`, n: e.n, c: 'var(--alert)' }))} total={h.classes['5xx']} />}
              {h.errors.length > 0 && <span className="small muted">Details are in Vercel → Logs. Ask Claude to look into any page that keeps showing up here.</span>}
            </section>
            <section className="card stack" style={{ gap: 12 }}>
              <strong>Responses by status</strong>
              <Bars rows={h.status.map((s) => ({ k: s.code, n: s.n, c: statusColor(s.code) }))} total={h.total} />
              <span className="small muted">2xx ok · 3xx redirects · 4xx not found or signed out · 5xx server errors</span>
            </section>
            <section className="card stack" style={{ gap: 12 }}>
              <strong>Busiest pages</strong>
              <Bars rows={h.paths.map((p) => ({ k: p.path, n: p.n }))} total={h.total} />
            </section>
            <section className="card stack" style={{ gap: 12 }}>
              <strong>Cache</strong>
              <Bars rows={h.cache.map((c) => ({ k: c.result, n: c.n, c: c.result === 'HIT' || c.result === 'PRERENDER' ? 'var(--rise)' : 'var(--gold)' }))} total={h.total} />
              <span className="small muted">HIT and PRERENDER are served instantly from Vercel’s edge. MISS runs the server.</span>
            </section>
          </div>
        </>
      )}
    </>
  );
}
