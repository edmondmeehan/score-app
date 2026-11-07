import { getBasemap } from '@/lib/basemap';
import HeatMap, { type Spot } from '@/components/HeatMap';
import type { supabaseServer } from '@/lib/supabase/server';

type Row = { key: string; name: string; kind: Spot['kind']; lat: number; lng: number; waiting: number; invited: number };
type Data = { spots: Row[]; unplaced: number; total: number };

const NYC_KINDS = new Set(['neighborhood', 'borough', 'area']);

/** Staff map of where waitlist people are, from the zip they entered. NYC area in detail, everywhere else by state. */
export default async function WaitlistMap({ supabase, view, test, baseQuery }: { supabase: Awaited<ReturnType<typeof supabaseServer>>; view: 'nyc' | 'us'; test: boolean; baseQuery: Record<string, string> }) {
  const [{ data, error }, tiles] = await Promise.all([supabase.rpc('staff_waitlist_map', { p_include_test: test }), getBasemap()]);
  const d = (data as Data | null) || { spots: [], unplaced: 0, total: 0 };
  const rows = d.spots || [];
  const nyc = rows.filter((r) => NYC_KINDS.has(r.kind));
  const elsewhere = rows.filter((r) => r.kind === 'state');
  const sum = (rs: Row[]) => rs.reduce((s, r) => s + r.waiting + r.invited, 0);
  const shown = view === 'nyc' ? nyc : rows;
  const spots: Spot[] = shown.map((r) => {
    const n = r.waiting + r.invited;
    return {
      name: r.name, kind: r.kind, lat: Number(r.lat), lng: Number(r.lng), weight: n,
      level: n >= 100 ? 'hot' : n >= 25 ? 'busy' : 'growing',
      detail: `${r.waiting} waiting${r.invited ? ` · ${r.invited} invited` : ''}`,
    };
  });
  const href = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...baseQuery, ...p })) if (v) q.set(k, v);
    const s = q.toString();
    return `/admin/waitlist${s ? `?${s}` : ''}#map`;
  };
  const list = (view === 'nyc' ? nyc : elsewhere).slice(0, 12);

  return (
    <section id="map" className="card stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Where the waitlist is</h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <a href={href({ map: undefined })} className={view === 'nyc' ? 'btn sm' : 'btn ghost sm'}>New York area</a>
          <a href={href({ map: 'us' })} className={view === 'us' ? 'btn sm' : 'btn ghost sm'}>Everywhere</a>
          <a href={href({ test: test ? undefined : '1' })} className="btn ghost sm">{test ? 'Hide test accounts' : 'Include test accounts'}</a>
        </div>
      </div>
      {error ? (
        <div className="notice error">Run migration 0018 in Supabase to turn on this map. ({error.message})</div>
      ) : (
        <>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <span><span className="serif" style={{ fontSize: 28 }}>{sum(nyc).toLocaleString()}</span> <span className="small muted">New York area</span></span>
            <span><span className="serif" style={{ fontSize: 28 }}>{sum(elsewhere).toLocaleString()}</span> <span className="small muted">elsewhere in the US</span></span>
            {d.unplaced > 0 && <span><span className="serif" style={{ fontSize: 28 }}>{d.unplaced.toLocaleString()}</span> <span className="small muted">no zip or not mappable</span></span>}
          </div>
          <HeatMap tiles={tiles} spots={spots} height={440}
            center={view === 'nyc' ? [40.73, -73.95] : [39.5, -96]} zoom={view === 'nyc' ? 10 : 4} minZoom={view === 'nyc' ? 8 : 3} />
          {list.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
              {list.map((r) => (
                <div key={r.key} className="row" style={{ justifyContent: 'space-between', gap: 8, padding: '8px 12px', border: '1px solid var(--line-soft)', borderRadius: 12 }}>
                  <span className="small">{r.name}</span>
                  <span className="mono small">{(r.waiting + r.invited).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          <span className="small muted">Staff only. Waiting and invited people, placed by the zip they entered: New York-area zips by neighborhood, borough or area, other US zips by state.{test ? ' Includes test accounts.' : ''}</span>
        </>
      )}
    </section>
  );
}
