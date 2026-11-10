import { supabaseServer } from '@/lib/supabase/server';
import { toggleMetroZip } from './actions';

export const dynamic = 'force-dynamic';
type Z = { zip: string; town: string; region: string; active: boolean };

/** Commuter towns that count as New York City. Turning one off makes members there Nomads. */
export default async function Zips({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from('metro_zip_codes').select('*').order('region').order('town').order('zip');
  const rows = (data as Z[]) || [];
  const regions = [...new Set(rows.map((r) => r.region))];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h1 className="serif" style={{ fontSize: 36, margin: 0 }}>Commuter zip codes</h1>
        <span className="small muted">Towns about an hour or less from Midtown by train. Members in an active zip are part of the NYC market. Turn a zip off and members there become Nomads right away; turn it on and they get Drops again.</span>
      </div>
      {(sp.error || error) && <div className="notice error">{sp.error || (/does not exist/.test(error!.message) ? 'Run migration 0060 in the SQL Editor first.' : error!.message)}</div>}
      {regions.map((reg) => {
        const list = rows.filter((r) => r.region === reg);
        return (
          <section key={reg} className="card stack" style={{ gap: 8 }}>
            <span className="label">{reg} · {list.filter((r) => r.active).length} of {list.length} on</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6 }}>
              {list.map((r) => (
                <form key={r.zip} action={toggleMetroZip} className="row" style={{ gap: 8, justifyContent: 'space-between', padding: '6px 10px', border: '1px solid var(--line-soft)', borderRadius: 10, opacity: r.active ? 1 : 0.55 }}>
                  <input type="hidden" name="zip" value={r.zip} /><input type="hidden" name="active" value={r.active ? '0' : '1'} />
                  <span className="small"><span className="mono">{r.zip}</span> {r.town}</span>
                  <button className="btn ghost sm" style={{ padding: '2px 10px' }}>{r.active ? 'On' : 'Off'}</button>
                </form>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
