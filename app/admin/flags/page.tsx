import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { staffAct } from '../actions';

export const dynamic = 'force-dynamic';

type Row = { sender: string; first_name: string | null; status: string; n: number; kinds: string[]; last_at: string; sample: string };
const KIND: Record<string, string> = { money: 'Money / scam', offplatform: 'Moving off Score', harassment: 'Harassment' };

export default async function Flags({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc('staff_flagged_messages');
  const rows = (data as Row[]) || [];
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Flagged messages</h1>
      <span className="small muted">Messages from the last 14 days that matched scam or harassment patterns. The person receiving them saw a safety warning. Nothing is blocked automatically: review the sender before acting.</span>
      {sp.error && <div className="notice error">{sp.error}</div>}
      {error && /Could not find the function/i.test(error.message) && <div className="notice error">Run migration 0028 in the Score SQL Editor first.</div>}
      {!error && rows.length === 0 && <div className="card small muted">Nothing flagged.</div>}
      {rows.map((r) => (
        <div key={r.sender} className="card stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span><Link href={`/admin/members/${r.sender}`}><strong>{r.first_name || 'Member'}</strong></Link> <span className="small muted">{r.status}</span></span>
            <span className="small">{r.n} flagged · {r.kinds.map((k) => KIND[k] || k).join(', ')}</span>
          </div>
          <span className="small muted" style={{ fontStyle: 'italic' }}>Latest: “{r.sample}”</span>
          {r.status !== 'suspended' && (
            <form action={staffAct} className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <input type="hidden" name="user" value={r.sender} /><input type="hidden" name="back" value="/admin/flags" />
              <input type="hidden" name="reason" value={`Flagged messages: ${r.kinds.join(', ')} (${r.n})`} />
              <button className="btn ghost sm" name="action" value="warn">Warn</button>
              <button className="btn ghost sm" name="action" value="suspend">Suspend</button>
            </form>
          )}
        </div>
      ))}
    </>
  );
}
