import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { BANDS, type Band } from '@/lib/types';

export default async function Overview() {
  const supabase = await supabaseServer();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count || 0;
  const head = { count: 'exact' as const, head: true };
  const [paying, preview, paused, waitlist, reports, review] = await Promise.all([
    count(supabase.from('profiles').select('id', head).in('plan', ['membership', 'premium', 'black'])),
    count(supabase.from('profiles').select('id', head).eq('plan', 'preview')),
    count(supabase.from('profiles').select('id', head).eq('plan', 'paused')),
    count(supabase.from('waitlist').select('id', head).eq('status', 'waiting')),
    count(supabase.from('reports').select('id', head).eq('status', 'open')),
    count(supabase.from('profiles').select('id', head).or('id_status.eq.review,photo_status.eq.review')),
  ]);
  const { data: bands } = await supabase.from('profiles').select('band').not('band', 'is', null);
  const total = bands?.length || 0;
  const share = (b: Band) => (total ? Math.round(((bands || []).filter((x) => x.band === b).length / total) * 100) : 0);
  const { data: an } = await supabase.rpc('staff_analytics', { p_days: 7 });
  const top = (an?.sources?.[0]?.k as string | undefined) || '—';
  const traffic: [string, string][] = an ? [['Visitors (7 days)', Number(an.visitors).toLocaleString()], ['Sessions (7 days)', Number(an.sessions).toLocaleString()], ['Members active today', Number(an.members_today).toLocaleString()], ['Top source', top]] : [];
  const kpis = [['Paying members', paying], ['Active Previews', preview], ['Paused or taken', paused], ['Waitlist', waitlist]] as const;
  return (
    <>
      <div className="stack" style={{ gap: 4 }}><span className="label">New York</span><h1 className="serif" style={{ fontSize: 44 }}>Overview</h1></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {kpis.map(([l, v]) => <div key={l} className="card stack" style={{ gap: 8 }}><span className="small muted">{l}</span><span className="serif" style={{ fontSize: 36 }}>{v.toLocaleString()}</span></div>)}
      </div>
      {traffic.length > 0 && (
        <Link href="/admin/analytics" className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, textDecoration: 'none', color: 'inherit' }}>
          {traffic.map(([l, v]) => <div key={l} className="stack" style={{ gap: 6 }}><span className="small muted">{l}</span><span className="serif" style={{ fontSize: 28 }}>{v}</span></div>)}
        </Link>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <section className="card stack" style={{ flex: '2 1 420px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Needs attention</h2>
          <Link href="/admin/moderation" className="list-row"><span className="serif" style={{ fontSize: 28, minWidth: 48, color: 'var(--gold-light)' }}>{reports}</span><span className="grow">Open reports</span><span className="small">Open</span></Link>
          <Link href="/admin/verification" className="list-row"><span className="serif" style={{ fontSize: 28, minWidth: 48, color: 'var(--gold-light)' }}>{review}</span><span className="grow">ID or photo reviews</span><span className="small">Open</span></Link>
        </section>
        <section className="card stack" style={{ flex: '1 1 280px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Members by band</h2>
          {(Object.keys(BANDS) as Band[]).map((b) => (
            <div key={b} className="stack" style={{ gap: 6 }}>
              <div className="row small" style={{ justifyContent: 'space-between' }}><span style={{ color: BANDS[b].color }}>{BANDS[b].label}</span><span className="muted">{share(b)}%</span></div>
              <div style={{ height: 8, borderRadius: 4, background: '#232327' }}><div style={{ height: 8, borderRadius: 4, width: `${share(b)}%`, background: BANDS[b].color }} /></div>
            </div>
          ))}
          <span className="small muted">Bands only. Exact scores are never stored.</span>
        </section>
      </div>
    </>
  );
}
