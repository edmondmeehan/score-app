import { requireStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';

const when = (d?: string | null) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const device = (ua?: string | null) => !ua ? '—' : /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? (/ScoreDateApp/.test(ua) ? 'iPhone app' : 'iPhone browser') : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';

type Status = { exists: boolean; first_name?: string; status?: string; plan?: string; id_status?: string; is_demo?: boolean; drop_today?: number; liked_by?: number; chats?: number; last_active?: string; logins_30d?: number; apple_30d?: number };
type Login = { id: number; at: string; city: string | null; region: string | null; country: string | null; ip: string | null; ua: string | null; apple: boolean };

/** App Review: is the reviewer account ready, and when has Apple signed in? */
export default async function AppReview() {
  const { supabase } = await requireStaff();
  const [{ data: st }, { data: logins }] = await Promise.all([
    supabase.rpc('staff_reviewer_status'),
    supabase.from('reviewer_logins').select('id, at, city, region, country, ip, ua, apple').order('at', { ascending: false }).limit(50),
  ]);
  const s = (st || { exists: false }) as Status;
  const rows = (logins || []) as Login[];
  const ready = s.exists && s.status === 'active' && s.id_status === 'approved' && (s.plan === 'premium' || s.plan === 'black') && (s.drop_today || 0) > 0;

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>App Review</h1>
      <p className="muted" style={{ margin: 0 }}>The reviewer account <strong>review@scoredate.app</strong> (“Alex”) refreshes every night with demo matches, likes and a new message. Each sign-in is logged here, and owners get a notification. Sign-ins from Apple’s network or Cupertino / San Jose are marked as Apple.</p>

      {!s.exists ? (
        <div className="notice error">The reviewer account doesn’t exist yet. Add review@scoredate.app in Supabase → Authentication, then run the reviewer setup SQL.</div>
      ) : (
        <section className="card stack" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <strong>{s.first_name || 'Reviewer'} · {ready ? <span style={{ color: 'var(--ok, #5FB07D)' }}>Ready for review</span> : <span style={{ color: 'var(--alert)' }}>Needs attention</span>}</strong>
            <span className="small muted">Last active {when(s.last_active)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {([['Plan', s.plan], ['ID', s.id_status], ['Drop today', s.drop_today], ['Liked by', s.liked_by], ['Open chats', s.chats], ['Demo world', s.is_demo ? 'Yes' : 'No']] as [string, unknown][]).map(([k, v]) => (
              <div key={k} className="stack" style={{ gap: 2 }}><span className="small muted">{k}</span><strong>{String(v ?? '—')}</strong></div>
            ))}
          </div>
          {!ready && <span className="small muted">It fixes itself tonight when the Drop flips. To fix it now, run in the SQL Editor: <span className="mono">select public.reviewer_refresh((select value from private.private_secrets where key = &apos;webhook_secret&apos;));</span></span>}
        </section>
      )}

      <section className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>Sign-ins</strong>
          <span className="small muted">{s.logins_30d ?? 0} in the last 30 days · {s.apple_30d ?? 0} look like Apple</span>
        </div>
        {rows.length === 0 ? <span className="small muted">No sign-ins yet. You’ll see one here (and get a notification) when Apple opens the app.</span> : (
          <div className="scroll-x">
            <table className="data" style={{ minWidth: 520 }}>
              <thead><tr><th>When (New York)</th><th>Where</th><th>Device</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{when(r.at)}</td>
                    <td>{[r.city, r.region, r.country].filter(Boolean).join(', ') || '—'}<div className="small muted mono">{r.ip || ''}</div></td>
                    <td>{device(r.ua)}</td>
                    <td>{r.apple ? <span className="chip" style={{ color: 'var(--gold-light)', borderColor: 'var(--gold)' }}>Apple</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <span className="small muted">Your own test sign-ins show here too. Locations come from the internet connection, so they’re approximate.</span>
      </section>
    </>
  );
}
