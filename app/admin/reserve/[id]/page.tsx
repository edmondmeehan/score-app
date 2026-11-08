import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { BANDS, type Band } from '@/lib/types';
import { addMatchmakerNote, assignMatchmaker, replyAsMatchmaker } from '../actions';

export const dynamic = 'force-dynamic';

type Msg = { id: number; from_member: boolean; body: string; staff_email: string | null; created_at: string };
type Note = { id: number; staff_email: string; body: string; created_at: string };
const when = (s: string) => new Date(s).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function ReserveMember({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const [{ data: p }, { data: msgs }, { data: notes }, { data: mms }] = await Promise.all([
    supabase.from('profiles').select('id, first_name, band, trend, neighborhood, job, plan, matchmaker_id, matchmaker_assigned_at').eq('id', id).maybeSingle(),
    supabase.from('matchmaker_messages').select('id, from_member, body, staff_email, created_at').eq('member_id', id).order('created_at').limit(300),
    supabase.from('matchmaker_notes').select('id, staff_email, body, created_at').eq('member_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('matchmakers').select('id, name, active').order('created_at'),
  ]);
  if (!p) notFound();
  const band = p.band as Band | null;
  const list = (mms as { id: string; name: string; active: boolean }[]) || [];

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 className="serif" style={{ fontSize: 40 }}>{p.first_name || 'Member'}</h1>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/admin/reserve" className="btn ghost sm">All Reserve members</Link>
          <Link href={`/admin/members/${p.id}`} className="btn ghost sm">Full profile</Link>
        </div>
      </div>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {p.plan !== 'black' && <div className="notice error">This member isn’t on Reserve right now. They can’t see messages until they are.</div>}
      <span className="small muted">{band ? <span style={{ color: BANDS[band].color }}>{BANDS[band].label}</span> : 'No band'}{p.trend === 'up' ? ' · trending up' : ''}{p.job ? ` · ${p.job}` : ''}{p.neighborhood ? ` · ${p.neighborhood}` : ''}</span>

      <form action={assignMatchmaker} className="card row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input type="hidden" name="member" value={p.id} />
        <input type="hidden" name="from" value={`/admin/reserve/${p.id}`} />
        <label className="field grow">Matchmaker
          <select className="input" name="matchmaker" defaultValue={p.matchmaker_id ?? ''}>
            <option value="">Not assigned</option>
            {list.filter((m) => m.active || m.id === p.matchmaker_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <button className="btn sm">Save</button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <section id="thread" className="card stack" style={{ gap: 10 }}>
          <strong>Messages with {p.first_name || 'member'}</strong>
          {(msgs as Msg[] || []).length === 0 && <span className="small muted">No messages yet. Send a welcome note and the booking link.</span>}
          {((msgs as Msg[]) || []).map((m) => (
            <div key={m.id} className="stack" style={{ gap: 2, alignItems: m.from_member ? 'flex-start' : 'flex-end' }}>
              <span style={{ maxWidth: '85%', padding: '9px 13px', borderRadius: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', background: m.from_member ? 'var(--bubble)' : 'var(--gold-wash)', color: m.from_member ? 'inherit' : 'var(--gold-light)' }}>{m.body}</span>
              <span className="small muted" style={{ fontSize: 11 }}>{m.from_member ? p.first_name || 'Member' : m.staff_email || 'Staff'} · {when(m.created_at)}</span>
            </div>
          ))}
          <form action={replyAsMatchmaker} className="stack" style={{ gap: 8 }}>
            <input type="hidden" name="member" value={p.id} />
            <textarea className="input" name="body" rows={3} maxLength={2000} required placeholder="Reply as the matchmaker" />
            <button className="btn sm">Send reply</button>
          </form>
        </section>
        <section id="notes" className="card stack" style={{ gap: 10 }}>
          <strong>Private notes</strong>
          <span className="small muted">Staff only. Never shown to the member.</span>
          <form action={addMatchmakerNote} className="stack" style={{ gap: 8 }}>
            <input type="hidden" name="member" value={p.id} />
            <textarea className="input" name="body" rows={3} maxLength={2000} required placeholder="Preferences, intros made, call notes…" />
            <button className="btn ghost sm">Add note</button>
          </form>
          {((notes as Note[]) || []).map((n) => (
            <div key={n.id} className="stack" style={{ gap: 2, borderTop: '1px solid var(--line-soft)', paddingTop: 8 }}>
              <span className="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{n.body}</span>
              <span className="small muted" style={{ fontSize: 11 }}>{n.staff_email} · {when(n.created_at)}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
