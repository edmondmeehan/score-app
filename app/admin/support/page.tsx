import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { updateTicket } from './actions';

const LABEL: Record<string, string> = { billing: 'Billing', account: 'Account', verification: 'Verification', safety: 'Safety', bug: 'Bug', feedback: 'Feedback', other: 'Other' };

export default async function SupportQueue({ searchParams }: { searchParams: Promise<{ view?: string; error?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === 'resolved' ? 'resolved' : 'open';
  const supabase = await supabaseServer();
  let q = supabase.from('support_tickets').select('*').order('priority', { ascending: true }).order('created_at', { ascending: view === 'open' }).limit(100);
  q = view === 'open' ? q.neq('status', 'resolved') : q.eq('status', 'resolved');
  const { data: tickets } = await q;
  const ids = Array.from(new Set((tickets || []).map((t) => t.user_id).filter(Boolean)));
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, first_name, plan').in('id', ids) : { data: [] };
  const who = Object.fromEntries((people || []).map((p) => [p.id, p]));
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1 className="serif" style={{ fontSize: 44 }}>Support</h1>
        <div className="row small"><Link href="/admin/support" className={view === 'open' ? '' : 'muted'}>Open</Link><span className="muted">·</span><Link href="/admin/support?view=resolved" className={view === 'resolved' ? '' : 'muted'}>Resolved</Link></div>
      </div>
      {sp.error && <div className="notice error">{sp.error}</div>}
      {(tickets || []).length === 0 && <p className="muted">{view === 'open' ? 'Inbox zero. Nothing waiting.' : 'Nothing resolved yet.'}</p>}
      {(tickets || []).map((t) => {
        const p = t.user_id ? who[t.user_id] : null;
        const subject = encodeURIComponent(`Re: ${t.subject}`);
        return (
          <section key={t.id} className="card stack">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <strong>{t.subject}</strong>
              <span className="row small" style={{ gap: 8 }}>
                <span className="chip small">{LABEL[t.category] || t.category}</span>
                {t.priority === 'high' && <span className="chip small" style={{ color: 'var(--alert)', borderColor: 'var(--alert)' }}>HIGH</span>}
                <span className="muted">{t.status}</span>
              </span>
            </div>
            <span className="small muted">
              {p ? <Link href={`/admin/members/${t.user_id}`}>{p.first_name || 'Member'}</Link> : 'Member'} · {p?.plan || '—'} · {t.email || 'no email'} · {new Date(t.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}
            </span>
            <div className="notice" style={{ color: 'var(--ivory)', whiteSpace: 'pre-wrap' }}>{t.body}</div>
            <form action={updateTicket} className="stack" style={{ gap: 8 }}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="current" value={t.status} />
              <input className="input" name="note" placeholder="Internal note (logged, not sent to the member)" defaultValue={t.staff_note || ''} />
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {t.email && <a className="btn ghost sm" href={`mailto:${t.email}?subject=${subject}`}>Reply by email</a>}
                <button className="btn ghost sm" name="status" value="">Save note</button>
                <button className="btn ghost sm" name="status" value="pending">Mark in progress</button>
                <button className="btn sm" name="status" value="resolved">Resolve</button>
                {t.status === 'resolved' && <button className="btn ghost sm" name="status" value="open">Reopen</button>}
              </div>
            </form>
          </section>
        );
      })}
      <span className="small muted">Safety tickets that name another member should also be filed as a report in Moderation so the member can be acted on.</span>
    </>
  );
}
