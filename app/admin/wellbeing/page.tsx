import { requireStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Row = { month: string; n: number; avg: number; low: number };

/** Monthly "How does dating feel?" check-ins. Aggregates only, no names. Watch this alongside engagement. */
export default async function Wellbeing() {
  const { supabase } = await requireStaff();
  const [{ data }, { count: focusCount }] = await Promise.all([
    supabase.rpc('staff_wellbeing'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('focus_mode', true),
  ]);
  const rows = (data as Row[]) || [];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 4 }}><span className="label">Members</span><h1 className="serif" style={{ fontSize: 44 }}>Member wellbeing</h1></div>
      <p className="muted small" style={{ margin: 0 }}>Monthly answers to “How does dating feel for you this month?” (1 Draining → 5 Great). Shown in aggregate only. If the average drops or “low” rises, look at notification volume, chat closures and Drop quality first.</p>
      <span className="small muted">{focusCount ?? 0} members have focus mode on.</span>
      <div className="card scroll-x"><table className="data" style={{ width: "100%" }}>
        <thead><tr><th>Month</th><th>Answers</th><th>Average</th><th>Draining or meh (1–2)</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="muted">No check-ins yet. They start showing to members 14 days after joining.</td></tr>}
          {rows.map((r) => <tr key={r.month}><td>{r.month}</td><td>{r.n}</td><td>{Number(r.avg).toFixed(2)}</td><td>{r.low} ({r.n ? Math.round((r.low / r.n) * 100) : 0}%)</td></tr>)}
        </tbody>
      </table></div>
    </div>
  );
}
