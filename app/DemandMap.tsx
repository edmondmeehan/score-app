import { supabaseAnon } from '@/lib/supabase/server';
import { getBasemap } from '@/lib/basemap';
import HeatMap, { Legend, type Spot } from '@/components/HeatMap';

type Row = { name: string; kind: Spot['kind']; lat: number; lng: number; live: boolean; members?: number | null; waiting: number | null; level: Spot['level'] };

/** Real demand only: waitlist counts by neighborhood (rounded, hidden when small), "Live" once members pass the minimum. */
export default async function DemandMap() {
  const [{ data }, { data: heat }, tiles] = await Promise.all([supabaseAnon().rpc('public_demand_map'), supabaseAnon().rpc('public_area_heat'), getBasemap()]);
  // Real people only. If the database still includes sample data (before migration 0018), show nothing from it.
  const demo = Boolean((data as { demo?: boolean } | null)?.demo);
  const rows = demo ? [] : ((data as { spots?: Row[] } | null)?.spots) || [];
  const total = demo ? null : (data as { total_waiting?: number | null } | null)?.total_waiting ?? null;
  const real: Spot[] = rows.map((r) => ({
    name: r.name, kind: r.kind, lat: Number(r.lat), lng: Number(r.lng), level: r.level,
    detail: r.live ? 'Live now' + (r.waiting ? ` · ${r.waiting}+ waiting` : '') : r.waiting ? `${r.waiting}+ on the waitlist` : 'Growing',
  }));
  // Before real counts pass the public minimum, show the borough-level preview (glow levels only, no numbers or claims).
  const preview = real.length === 0;
  const spots: Spot[] = preview ? (((heat as Spot[]) || []).map((h) => ({ ...h, lat: Number(h.lat), lng: Number(h.lng), detail: h.open === false ? 'Opening soon' : 'Opening neighborhood by neighborhood' }))) : real;
  const top = rows.filter((r) => r.waiting || r.live).slice(0, 6);

  return (
    <section id="where" className="page" style={{ padding: '72px 24px 24px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Where ScoreDate is live</span>
          <h2 className="serif" style={{ fontSize: 'clamp(36px, 6vw, 52px)', lineHeight: 1.02, margin: 0 }}>
            {total ? `${total.toLocaleString('en-US')}+ New Yorkers are waiting.` : 'Opening neighborhood by neighborhood.'}
          </h2>
        </div>
        <a href="#invite" className="btn ghost sm">Add my neighborhood</a>
      </div>
      <HeatMap tiles={tiles} spots={spots} height={380} center={[40.74, -73.97]} zoom={11} />
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
        <Legend />
        <span className="small muted">{preview ? 'Preview of the live map. It fills in as New York joins the waitlist.' : 'Counts are real requests, rounded down. Never individuals.'}</span>
      </div>
      {top.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 20 }}>
          {top.map((r) => (
            <div key={r.name} className="card stack" style={{ gap: 2, padding: '14px 16px' }}>
              <strong>{r.name}</strong>
              <span className="small muted">{r.live ? 'Live now' : `${r.waiting}+ on the waitlist`}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 18 }}>We open neighborhoods as they fill up. Request an invite to put yours on the map.</p>
      )}
    </section>
  );
}
