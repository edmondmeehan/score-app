import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { gday, usd, type Giveaway } from '@/lib/giveaways';

export const dynamic = 'force-dynamic';

export default async function AdminGiveaways() {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from('giveaways').select('*').order('created_at', { ascending: false }).limit(100);
  const list = (data as Giveaway[]) || [];
  const counts = await Promise.all(list.map((g) => supabase.from('giveaway_entries').select('id', { count: 'exact', head: true }).eq('giveaway_id', g.id).then((r) => r.count || 0)));
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="serif" style={{ fontSize: 44 }}>Giveaways</h1>
        <Link href="/admin/giveaways/new" className="btn sm">New giveaway</Link>
      </div>
      <span className="small muted">Free-to-enter giveaways. They show in the app’s Discover tab and at scoredate.app/giveaways. Keep total prizes under $5,000 per giveaway to avoid New York and Florida registration, and have counsel review the rules before the first one.</span>
      {error && <div className="notice">Run migration 0050 in the SQL Editor first.</div>}
      <div className="card scroll-x">
        <table className="data" style={{ minWidth: 640 }}>
          <thead><tr><th>Giveaway</th><th>Prize</th><th>Runs</th><th>Status</th><th>Entries</th></tr></thead>
          <tbody>
            {list.map((g, i) => (
              <tr key={g.id}>
                <td><Link href={`/admin/giveaways/${g.id}`}>{g.title}</Link></td>
                <td className="muted">{g.winners_count} × {usd(Number(g.prize_value_usd))}</td>
                <td className="mono small">{gday(g.starts_at)} – {gday(g.ends_at)}</td>
                <td style={{ color: g.status === 'live' ? 'var(--rise)' : g.status === 'cancelled' ? 'var(--alert)' : 'var(--muted)' }}>{g.status}</td>
                <td className="mono">{counts[i]}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="muted">No giveaways yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
