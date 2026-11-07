import { supabaseServer } from '@/lib/supabase/server';
import { getBasemap } from '@/lib/basemap';
import HeatMap, { type Spot } from '@/components/HeatMap';
import { setPublicMapDemo } from './actions';

export const dynamic = 'force-dynamic';

type Row = { key: string; name: string; kind: Spot['kind']; lat: number; lng: number; live: number; women: number; men: number; nonbinary: number; paying: number; preview: number; onboarding: number; waiting: number };

export default async function AdminMap({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const sp = await searchParams;
  const show = sp.show === 'waiting' ? 'waiting' : 'live';
  const supabase = await supabaseServer();
  const [{ data, error }, { data: min }, { data: demoRow }] = await Promise.all([supabase.rpc('staff_map'), supabase.rpc('map_min'), supabase.from('app_config').select('value').eq('key', 'public_map_demo').maybeSingle()]);
  const demoOn = demoRow?.value === true;
  const rows = (data as Row[]) || [];
  const spots: Spot[] = rows.filter((r) => r[show] > 0).map((r) => ({
    name: r.name, kind: r.kind, lat: Number(r.lat), lng: Number(r.lng), level: r[show] >= 100 ? 'hot' : r[show] >= 25 ? 'busy' : 'growing',
    weight: r[show], detail: show === 'live' ? `${r.live} live · ${r.women}W / ${r.men}M${r.nonbinary ? ` / ${r.nonbinary}NB` : ''} · ${r.paying} paying` : `${r.waiting} waiting`,
  }));
  const totals = rows.reduce((t, r) => ({ live: t.live + r.live, women: t.women + r.women, men: t.men + r.men, waiting: t.waiting + r.waiting }), { live: 0, women: 0, men: 0, waiting: 0 });
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1 className="serif" style={{ fontSize: 44 }}>Map</h1>
        <div className="row" style={{ gap: 8 }}>
          <a href="/admin/map" className={show === 'live' ? 'btn sm' : 'btn ghost sm'}>Members</a>
          <a href="/admin/map?show=waiting" className={show === 'waiting' ? 'btn sm' : 'btn ghost sm'}>Waitlist</a>
        </div>
      </div>
      <form action={setPublicMapDemo} className="card row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span className="stack grow" style={{ gap: 2 }}>
          <strong>Public map: {demoOn ? 'showing sample data' : 'real data only'}</strong>
          <span className="small muted">{demoOn ? 'The home page map includes test accounts and shows a “Preview · sample data” tag.' : 'Turn on to include test accounts on the home page map while you launch. It is always labeled as sample data.'}</span>
        </span>
        <input type="hidden" name="on" value={demoOn ? 'false' : 'true'} />
        <button className={demoOn ? 'btn ghost sm' : 'btn sm'}>{demoOn ? 'Switch to real data' : 'Show sample data'}</button>
      </form>
      {error && <div className="notice error">Run migration 0008 in Supabase to turn on the map. ({error.message})</div>}
      <span className="small muted">Staff only: real counts. Members see heat levels only, for groups of {min ?? 25}+, and never gender or plan.</span>
      <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
        <span><span className="serif" style={{ fontSize: 30 }}>{totals.live}</span> <span className="small muted">live members</span></span>
        <span><span className="serif" style={{ fontSize: 30 }}>{totals.women}/{totals.men}</span> <span className="small muted">women/men</span></span>
        <span><span className="serif" style={{ fontSize: 30 }}>{totals.waiting}</span> <span className="small muted">waiting</span></span>
      </div>
      <HeatMap tiles={await getBasemap()} spots={spots} height={520} />
      <div className="card scroll-x">
        <table className="data" style={{ minWidth: 820 }}>
          <thead><tr><th>Place</th><th>Live</th><th>Women</th><th>Men</th><th>NB</th><th>Balance</th><th>Paying</th><th>Preview</th><th>Onboarding</th><th>Waiting</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const both = r.women + r.men;
              const pct = both ? Math.round((r.women / both) * 100) : null;
              return (
                <tr key={r.key}>
                  <td>{r.name} <span className="small muted">{r.kind === 'neighborhood' ? '' : `· ${r.kind}`}</span></td>
                  <td className="mono">{r.live}</td><td className="mono">{r.women}</td><td className="mono">{r.men}</td><td className="mono muted">{r.nonbinary}</td>
                  <td className="mono" style={{ color: pct === null ? 'var(--muted)' : pct < 35 || pct > 65 ? 'var(--alert)' : 'var(--rise)' }}>{pct === null ? '—' : `${pct}% W`}</td>
                  <td className="mono">{r.paying}</td><td className="mono muted">{r.preview}</td><td className="mono muted">{r.onboarding}</td><td className="mono">{r.waiting}</td>
                </tr>
              );
            })}
            {rows.length === 0 && !error && <tr><td colSpan={10} className="muted">No one with a zip code yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Balance turns red outside 35–65% women. Zips without a neighborhood fall back to their borough or area. Members who opted out of the map are still counted here.</p>
    </>
  );
}
