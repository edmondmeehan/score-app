import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { staffAct } from '../actions';

export const dynamic = 'force-dynamic';

type M = { id: string; first_name: string | null; status: string; n: number; profiles: number; last_at: string };

export default async function Screenshots({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc('staff_screenshot_review');
  const r = (data as { threshold: number; members: M[] }) || { threshold: 10, members: [] };
  const notReady = error && /Could not find the function/i.test(error.message);
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Screenshots</h1>
      <span className="small muted">Members whose screenshots we detected in the last 7 days. Review threshold: {r.threshold}. Nothing happens automatically. Look at the context (a lot of different profiles is a warning sign; a few of their own matches usually isn’t) before warning or suspending.</span>
      {sp.error && <div className="notice error">{sp.error}</div>}
      {notReady && <div className="notice error">Run migration 0026 in the Score SQL Editor first.</div>}
      {r.members.length === 0 && !notReady && <div className="card small muted">No one is near the threshold.</div>}
      {r.members.length > 0 && (
        <div className="card scroll-x" style={{ overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Member</th><th>Screenshots</th><th>Different profiles</th><th>Last</th><th /></tr></thead>
            <tbody>
              {r.members.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/admin/members/${m.id}`}>{m.first_name || 'Member'}</Link> <span className="small muted">{m.status}</span></td>
                  <td style={{ color: m.n >= r.threshold ? 'var(--alert)' : undefined }}>{m.n}</td>
                  <td>{m.profiles}</td>
                  <td className="small muted">{new Date(m.last_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td>
                    {m.status !== 'suspended' && (
                      <form action={staffAct} className="row" style={{ gap: 6 }}>
                        <input type="hidden" name="user" value={m.id} /><input type="hidden" name="back" value="/admin/screenshots" />
                        <input type="hidden" name="reason" value={`Screenshots of other members (${m.n} in 7 days)`} />
                        <button className="btn ghost sm" name="action" value="warn">Warn</button>
                        <button className="btn ghost sm" name="action" value="suspend">Suspend</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <span className="small muted">What’s detected: PrintScreen and screenshot shortcuts on computers, and screenshots in the Score iPhone and Android apps. In the Android app, screenshots of the app are blocked outright. Phone browsers can’t detect screenshots.</span>
    </>
  );
}
