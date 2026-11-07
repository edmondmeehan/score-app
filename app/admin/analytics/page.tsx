import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { BANDS, type Band } from '@/lib/types';

type KV = { k: string; n: number };
type A = {
  visitors: number; sessions: number; pageviews: number; members_active: number; members_today: number;
  daily: { day: string; visitors: number; pageviews: number }[];
  sources: KV[]; campaigns: KV[]; pages: KV[]; os: KV[]; devices: KV[]; browsers: KV[]; cities: KV[]; events: KV[];
  most_active: { id: string; first_name: string | null; band: Band | null; borough: string | null; status: string; views: number; messages: number; last_seen: string }[];
  funnel: Record<string, number>;
};

function Bars({ title, rows, unit, empty = 'No data yet.' }: { title: string; rows: KV[]; unit?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  return (
    <section className="card stack" style={{ flex: '1 1 300px', gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
      {rows.length === 0 && <span className="small muted">{empty}</span>}
      {rows.map((r) => (
        <div key={r.k} className="stack" style={{ gap: 4 }}>
          <div className="row small" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.k}</span>
            <span className="muted mono">{r.n.toLocaleString()}{unit ? ` ${unit}` : ''} · {Math.round((r.n / total) * 100)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--track)' }}><div style={{ height: 6, borderRadius: 3, width: `${(r.n / max) * 100}%`, background: 'var(--gold)' }} /></div>
        </div>
      ))}
    </section>
  );
}

const RANGES = [7, 30, 90];
const EVENT_LABEL: Record<string, string> = {
  waitlist_join: 'Joined waitlist (website)', waitlist_join_app: 'Joined waitlist (app)', notify_outside_nyc: 'Outside NYC: notify me', invite_redeemed: 'Redeemed invite', onboarding_basics: 'Finished basics',
};

export default async function Analytics({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.d)) ? Number(sp.d) : 30;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('staff_analytics', { p_days: days });
  if (error) return <div className="notice error">Analytics isn&apos;t set up yet: run migration 0004 in Supabase. ({error.message})</div>;
  const a = data as A;
  const maxDay = Math.max(1, ...a.daily.map((d) => d.visitors));
  const kpis: [string, string][] = [
    ['Visitors', a.visitors.toLocaleString()], ['Sessions', a.sessions.toLocaleString()], ['Page views', a.pageviews.toLocaleString()],
    ['Pages per session', a.sessions ? (a.pageviews / a.sessions).toFixed(1) : '0'], ['Members active', a.members_active.toLocaleString()], ['Members today', a.members_today.toLocaleString()],
  ];
  const f = a.funnel;
  const funnel: [string, number][] = [['Joined waitlist', f.waitlist], ['Redeemed invite', f.invites_redeemed], ['Finished basics', f.basics_done], ['ID verified', f.id_verified], ['Band verified', f.band_verified], ['Paying', f.paying]];
  const fmax = Math.max(1, ...funnel.map(([, n]) => n));
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}><span className="label">Last {days} days · staff visits excluded</span><h1 className="serif" style={{ fontSize: 44 }}>Analytics</h1></div>
        <div className="row" style={{ gap: 8 }}>{RANGES.map((r) => <Link key={r} href={`/admin/analytics?d=${r}`} className={r === days ? 'btn sm' : 'btn ghost sm'}>{r} days</Link>)}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        {kpis.map(([l, v]) => <div key={l} className="card stack" style={{ gap: 8 }}><span className="small muted">{l}</span><span className="serif" style={{ fontSize: 34 }}>{v}</span></div>)}
      </div>

      <section className="card stack">
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Visitors per day</h2>
        {a.daily.length === 0 ? <span className="small muted">No visits recorded yet. Tracking starts once migration 0004 is in.</span> : (
          <div className="row" style={{ alignItems: 'flex-end', gap: 3, height: 160 }}>
            {a.daily.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.visitors} visitors, ${d.pageviews} views`} style={{ flex: 1, minWidth: 4, height: `${Math.max(3, (d.visitors / maxDay) * 100)}%`, background: 'var(--gold)', borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
            ))}
          </div>
        )}
        {a.daily.length > 0 && <div className="row small muted" style={{ justifyContent: 'space-between' }}><span>{a.daily[0].day}</span><span>{a.daily[a.daily.length - 1].day}</span></div>}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Bars title="Traffic sources" rows={a.sources} unit="visits" />
        <Bars title="Top pages" rows={a.pages} unit="views" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Bars title="Platforms" rows={a.os} unit="people" />
        <Bars title="Devices" rows={a.devices} unit="people" />
        <Bars title="Browsers and in-app" rows={a.browsers} unit="people" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Bars title="Where visitors are" rows={a.cities} unit="people" />
        <Bars title="Campaigns (utm_campaign)" rows={a.campaigns} unit="visits" empty="Add ?utm_source=…&utm_campaign=… to links you share to see them here." />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <section className="card stack" style={{ flex: '1 1 320px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Sign-up funnel</h2>
          {funnel.map(([l, n]) => (
            <div key={l} className="stack" style={{ gap: 4 }}>
              <div className="row small" style={{ justifyContent: 'space-between' }}><span>{l}</span><span className="mono muted">{n.toLocaleString()}</span></div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--track)' }}><div style={{ height: 10, borderRadius: 5, width: `${(n / fmax) * 100}%`, background: 'var(--gold)' }} /></div>
            </div>
          ))}
          
        </section>
        <Bars title="Key actions" rows={a.events.map((e) => ({ k: EVENT_LABEL[e.k] || e.k.replace('plan_chosen:', 'Chose plan: '), n: e.n }))} />
      </div>

      <section className="card scroll-x">
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Most active members</h2>
        <table className="data" style={{ minWidth: 680 }}>
          <thead><tr><th>Member</th><th>Band</th><th>Borough</th><th>Status</th><th>Page views</th><th>Messages sent</th><th>Last seen</th></tr></thead>
          <tbody>
            {a.most_active.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/admin/members/${m.id}`}>{m.first_name || 'Member'}</Link></td>
                <td style={{ color: m.band ? BANDS[m.band].color : undefined }}>{m.band ? BANDS[m.band].label : '—'}</td>
                <td className="muted">{m.borough || '—'}</td><td className="muted">{m.status}</td>
                <td className="mono">{m.views}</td><td className="mono">{m.messages}</td>
                <td className="muted">{new Date(m.last_seen).toLocaleString()}</td>
              </tr>
            ))}
            {a.most_active.length === 0 && <tr><td colSpan={7} className="muted">No member activity yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
