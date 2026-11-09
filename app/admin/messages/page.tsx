import { requireStaff } from '@/lib/session';
import Composer from './Composer';

export const dynamic = 'force-dynamic';

type Row = { id: string; title: string; body: string; channels: string[]; status: string; scheduled_at: string | null; sent_at: string | null; audience_count: number | null; sent_count: number | null; skipped_cap: number | null; created_by: string | null; created_at: string };
const when = (d: string | null) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '—');
const CH: Record<string, string> = { inapp: 'In-app', push: 'Push', email: 'Email' };

export default async function MessageMembers() {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from('member_campaigns').select('*').order('created_at', { ascending: false }).limit(50);
  const rows = (data as Row[]) || [];
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Message members</h1>
      <span className="small muted">Send an in-app message, push notification or email to members picked by location and interests. Members’ notification settings, quiet hours and unsubscribes are always respected, and nobody gets more than one of these every 3 days. Religion and politics can’t be targeted.</span>
      {error && <div className="notice">Run migration 0053 in the SQL Editor first.</div>}
      <Composer />
      <section className="card stack" style={{ gap: 8 }}>
        <strong>Sent and scheduled</strong>
        {rows.length === 0 ? <span className="small muted">Nothing yet.</span> : (
          <div className="scroll-x">
            <table className="data" style={{ minWidth: 720 }}>
              <thead><tr><th>Message</th><th>Channels</th><th>Status</th><th>When</th><th>Reached</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.title}</strong><div className="small muted">{r.body}</div></td>
                    <td className="small">{r.channels.map((c) => CH[c] || c).join(' · ')}</td>
                    <td style={{ textTransform: 'capitalize', color: r.status === 'sent' ? 'var(--rise)' : r.status === 'scheduled' ? 'var(--gold-light)' : undefined }}>{r.status}</td>
                    <td className="mono small">{when(r.sent_at || r.scheduled_at || r.created_at)}</td>
                    <td className="mono small">{r.sent_count ?? '—'}{r.skipped_cap ? <span className="muted"> ({r.skipped_cap} skipped, messaged recently)</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
