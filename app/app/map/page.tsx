import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { getBasemap } from '@/lib/basemap';
import HeatMap, { Legend, type Spot } from '@/components/HeatMap';

export const dynamic = 'force-dynamic';

export default async function MemberMap() {
  const { supabase, me } = await requireMember();
  const [{ data }, { data: min }] = await Promise.all([supabase.rpc('member_heatmap'), supabase.rpc('map_min')]);
  const spots = (data as Spot[]) || [];
  return (
    <div className="phone">
      <div className="row"><Link href="/app" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link><span className="eyebrow">Members only</span></div>
      <h1 className="serif" style={{ fontSize: 40 }}>Where Score is busy</h1>
      <span className="muted small">Neighborhoods with the most members. Nobody&apos;s location is shown, only groups of {min ?? 25}+.</span>
      <HeatMap tiles={await getBasemap()} spots={spots} height={420} />
      <Legend />
      {spots.length === 0 && <div className="notice">The map lights up as neighborhoods reach {min ?? 25} members. Invite someone you&apos;d vouch for to get yours on it.</div>}
      {spots.length > 0 && (
        <div className="card stack" style={{ gap: 8 }}>
          {spots.map((s) => (
            <div key={s.name} className="row small" style={{ justifyContent: 'space-between' }}>
              <span>{s.name}</span><span style={{ color: s.level === 'hot' ? '#F0C96A' : s.level === 'busy' ? 'var(--gold)' : 'var(--muted)' }}>{s.level === 'hot' ? 'Hot' : s.level === 'busy' ? 'Busy' : 'Growing'}</span>
            </div>
          ))}
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        Based on home zip codes, grouped by neighborhood. Small neighborhoods are folded into their borough so no one stands out.
        {me.map_opt_out ? ' You’re not included. ' : ' '}<Link href="/app/settings#privacy">{me.map_opt_out ? 'Change' : 'Leave me off the map'}</Link>
      </p>
    </div>
  );
}
