import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { staffAct } from '../actions';

export default async function Moderation() {
  const supabase = await supabaseServer();
  const { data: reports } = await supabase.from('reports').select('*').eq('status', 'open').order('created_at');
  const ids = Array.from(new Set((reports || []).flatMap((r) => [r.reporter_id, r.reported_id]).filter(Boolean)));
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, first_name, email, invited_by').in('id', ids) : { data: [] };
  const name = Object.fromEntries((people || []).map((p) => [p.id, p.first_name || p.email]));
  const urgent = (r: string) => /money|Harassment/i.test(r);
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Moderation</h1>
      {(reports || []).length === 0 && <p className="muted">No open reports.</p>}
      {(reports || []).sort((a, b) => Number(urgent(b.reason)) - Number(urgent(a.reason))).map((r) => (
        <section key={r.id} className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}><strong>{r.reason}</strong>{urgent(r.reason) && <span className="chip small" style={{ color: 'var(--alert)', borderColor: 'var(--alert)' }}>URGENT</span>}</div>
          <span className="small muted">Reported by {name[r.reporter_id] || 'a member'} about <Link href={`/admin/members/${r.reported_id}`}>{name[r.reported_id] || 'member'}</Link> · {new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}</span>
          {r.note && <div className="notice" style={{ color: 'var(--ivory)' }}>{r.note}</div>}
          <form action={staffAct} className="row" style={{ flexWrap: 'wrap' }}>
            <input type="hidden" name="user" value={r.reported_id} /><input type="hidden" name="report" value={r.id} /><input type="hidden" name="back" value="/admin/moderation" />
            <input className="input" name="reason" placeholder="Reason (logged)" required style={{ maxWidth: 280 }} />
            <button className="btn ghost sm" name="action" value="dismiss">Dismiss</button>
            <button className="btn ghost sm" name="action" value="warn">Warn</button>
            <button className="btn ghost sm" name="action" value="suspend">Suspend</button>
            <button className="btn danger sm" name="action" value="remove">Remove</button>
          </form>
        </section>
      ))}
      <span className="small muted">Every action is logged with your name. Removed members&apos; App Store subscriptions are cancelled by Apple, not here.</span>
    </>
  );
}
