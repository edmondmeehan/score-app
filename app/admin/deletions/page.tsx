import { supabaseServer } from '@/lib/supabase/server';

export default async function Deletions() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from('deletion_requests').select('*').order('requested_at', { ascending: false }).limit(100);
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Deletion requests</h1>
      <p className="muted" style={{ margin: 0 }}>Most deletions finish instantly. Requests on hold (for example, an open report) appear here and must be finished within 30 days.</p>
      <div className="card scroll-x"><table className="data" style={{ minWidth: 640 }}>
        <thead><tr><th>Email</th><th>Requested</th><th>Due by</th><th>Status</th><th>Hold</th></tr></thead>
        <tbody>{(data || []).map((d) => <tr key={d.user_id}><td>{d.email}</td><td className="muted">{new Date(d.requested_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</td><td>{new Date(new Date(d.requested_at).getTime() + 30 * 86400000).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</td><td>{d.status}</td><td className="muted">{d.hold_reason || '—'}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}
