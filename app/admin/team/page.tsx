import { requireStaff } from '@/lib/session';
import { addAdmin, removeAdmin, resendWelcome } from './actions';
import ConfirmButton from '@/components/ConfirmButton';

export const dynamic = 'force-dynamic';

type Admin = { email: string; name: string | null; role: string; added_by: string | null; created_at: string; welcomed_at: string | null; has_account: boolean; last_sign_in: string | null };
const ROLE: Record<string, string> = { owner: 'Full access', moderator: 'Moderator', verification: 'Verification', community: 'Community' };
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export default async function Team({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, staffEmail } = await requireStaff();
  const [{ data, error }, { data: isOwner }] = await Promise.all([supabase.rpc('staff_list'), supabase.rpc('is_owner')]);
  const notReady = error && /Could not find the function|schema cache/i.test(error.message);
  const admins = (data as Admin[]) || [];

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Admins</h1>
      <span className="small muted">Everyone here can open the admin. New admins get full access and a welcome email with a link to sign in.</span>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {notReady && <div className="notice error">Run migration 0032 in the ScoreDate SQL Editor first.</div>}

      {isOwner ? (
        <section className="card stack" style={{ gap: 10 }}>
          <strong>Add an admin</strong>
          <form action={addAdmin} className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: '1 1 180px' }}>Name<input className="input" name="name" required maxLength={80} autoComplete="off" /></label>
            <label className="field" style={{ flex: '2 1 240px' }}>Email<input className="input" name="email" type="email" required autoComplete="off" /></label>
            <button className="btn sm" style={{ minHeight: 44 }}>Add and send welcome</button>
          </form>
          <span className="small muted">They’ll sign in (or create an account) with that exact email. Admins can see members’ private information, so only add people who need it.</span>
        </section>
      ) : (
        <div className="card small muted">Only owners can add or remove admins.</div>
      )}

      <section className="card scroll-x" style={{ overflowX: 'auto' }}>
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>Name</th><th>Email</th><th>Access</th><th>Added</th><th>Last sign-in</th><th /></tr></thead>
          <tbody>
            {admins.map((a) => {
              const me = a.email.toLowerCase() === (staffEmail || '').toLowerCase();
              return (
                <tr key={a.email}>
                  <td>{a.name || '—'}{me && <span className="small muted"> (you)</span>}</td>
                  <td className="mono small">{a.email}</td>
                  <td>{ROLE[a.role] || a.role}</td>
                  <td className="small">{day(a.created_at)}{a.added_by ? <span className="muted"> · by {a.added_by}</span> : null}</td>
                  <td className="small">{a.last_sign_in ? day(a.last_sign_in) : <span className="muted">{a.has_account ? 'Never' : 'No account yet'}</span>}</td>
                  <td>
                    {isOwner && !me && (
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        {!a.last_sign_in && (
                          <form action={resendWelcome}><input type="hidden" name="email" value={a.email} /><input type="hidden" name="name" value={a.name || ''} /><button className="btn ghost sm">Resend welcome</button></form>
                        )}
                        <form action={removeAdmin}><input type="hidden" name="email" value={a.email} /><ConfirmButton className="btn danger sm" message={`Remove ${a.name || a.email}? They’ll lose admin access right away.`}>Remove</ConfirmButton></form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {admins.length === 0 && !notReady && <tr><td colSpan={6} className="small muted">No admins found.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
