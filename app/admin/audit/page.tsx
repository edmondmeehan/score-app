import { supabaseServer } from '@/lib/supabase/server';

export default async function Audit() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Audit log</h1>
      <span className="small muted">Read-only. Entries can&apos;t be edited or deleted from the app.</span>
      <div className="card scroll-x"><table className="data" style={{ minWidth: 720 }}>
        <thead><tr><th>When</th><th>Staff</th><th>Action</th><th>Member</th><th>Reason</th></tr></thead>
        <tbody>{(data || []).map((l) => <tr key={l.id}><td className="mono small muted">{new Date(l.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td><td>{l.staff_email}</td><td>{l.action}</td><td className="muted small">{l.target_user?.slice(0, 8) || '—'}</td><td className="muted">{l.reason}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}
