import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { getReserveVisible } from '@/lib/reserve';
import { BANDS, PLANS, type Band } from '@/lib/types';
import { assignMatchmaker, saveMatchmaker, setReserveVisible } from './actions';

export const dynamic = 'force-dynamic';

type MM = { id: string; name: string; staff_email: string | null; photo_url: string | null; bio: string | null; booking_url: string | null; contact_email: string; active: boolean };
type Member = { id: string; first_name: string | null; band: Band | null; neighborhood: string | null; matchmaker_id: string | null; matchmaker: string | null; assigned_at: string | null; waiting: number; last_at: string | null };
const ago = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }) : '—');

function MatchmakerForm({ m }: { m?: MM }) {
  return (
    <form action={saveMatchmaker} className="stack" style={{ gap: 10 }}>
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label className="field grow">Name<input className="input" name="name" defaultValue={m?.name} required minLength={2} maxLength={60} /></label>
        <label className="field grow">Staff login email<input className="input" name="staff_email" type="email" defaultValue={m?.staff_email ?? ''} placeholder="Optional" /></label>
      </div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label className="field grow">Booking link<input className="input" name="booking_url" defaultValue={m?.booking_url ?? ''} placeholder="https://calendly.com/…" /></label>
        <label className="field grow">Email members see<input className="input" name="contact_email" type="email" defaultValue={m?.contact_email ?? 'reserve@scoredate.app'} /></label>
      </div>
      <label className="field">Photo link<input className="input" name="photo_url" defaultValue={m?.photo_url ?? ''} placeholder="https://… (optional)" /></label>
      <label className="field">Short bio<textarea className="input" name="bio" rows={2} maxLength={400} defaultValue={m?.bio ?? ''} /></label>
      <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="active" defaultChecked={m ? m.active : true} /> Active (can be assigned)</label>
      <div><button className="btn sm">{m ? 'Save' : 'Add matchmaker'}</button></div>
    </form>
  );
}

export default async function ReserveAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const [visible, { data: role }, { data: mms, error: e1 }, { data: members, error: e2 }] = await Promise.all([
    getReserveVisible(supabase),
    supabase.rpc('staff_role'),
    supabase.from('matchmakers').select('*').order('created_at'),
    supabase.rpc('staff_reserve_members'),
  ]);
  const owner = role === 'owner';
  const missing = (e: { code?: string; message: string } | null) => Boolean(e && (e.code === '42P01' || e.code === 'PGRST202' || e.code === 'PGRST205' || /Could not find the (table|function)/i.test(e.message)));
  const notReady = missing(e1) || missing(e2);
  const otherError = [e1, e2].find((e) => e && !missing(e));
  const list = (mms as MM[]) || [];
  const active = list.filter((m) => m.active);
  const rows = (members as Member[]) || [];
  const unassigned = rows.filter((r) => !r.matchmaker_id).length;
  const waiting = rows.reduce((s, r) => s + (r.waiting > 0 ? 1 : 0), 0);

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Reserve</h1>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {notReady && <div className="notice error">Run migration 0022 in the ScoreDate SQL Editor to turn on matchmakers. ({(e1 || e2)?.message})</div>}
      {otherError && <div className="notice error">Couldn’t load Reserve data: {otherError.message}{otherError.code ? ` (${otherError.code})` : ''}</div>}

      <section className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>Offer Reserve to members</strong>
          <span className="chip small" style={{ color: visible ? 'var(--rise)' : 'var(--muted)' }}>{visible ? 'Showing' : 'Hidden'}</span>
        </div>
        <span className="small muted">
          {visible ? `Members can choose Reserve (${PLANS.black.monthly}) on the plans page.` : 'Reserve is hidden from the plans page and from event and search wording. New members can’t choose it. Anyone already on Reserve keeps it and their matchmaker.'}
          {' '}Also hide or show the Reserve product in RevenueCat and App Store Connect so the iPhone app matches.
        </span>
        {!visible && active.length === 0 && <span className="small" style={{ color: 'var(--gold)' }}>Add at least one active matchmaker with a booking link before you turn this on.</span>}
        {owner ? (
          <form action={setReserveVisible}>
            <input type="hidden" name="on" value={visible ? 'false' : 'true'} />
            <button className={visible ? 'btn ghost sm' : 'btn sm'} disabled={!visible && active.length === 0}>{visible ? 'Hide Reserve' : 'Show Reserve'}</button>
          </form>
        ) : <span className="small muted">Only owners can change this.</span>}
      </section>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        {[[rows.length, 'Reserve members'], [unassigned, 'Need a matchmaker'], [waiting, 'Waiting on a reply'], [active.length, 'Active matchmakers']].map(([n, l]) => (
          <div key={l as string} className="card stack" style={{ gap: 2, flex: '1 1 140px' }}><span className="serif" style={{ fontSize: 30, color: (l === 'Need a matchmaker' || l === 'Waiting on a reply') && Number(n) > 0 ? 'var(--gold)' : undefined }}>{n}</span><span className="small muted">{l}</span></div>
        ))}
      </div>

      <section className="card stack" style={{ gap: 12 }}>
        <strong>Reserve members</strong>
        {rows.length === 0 && <span className="small muted">No Reserve members yet.</span>}
        {rows.length > 0 && (
          <div className="scroll-x" style={{ overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Member</th><th>Band</th><th>Matchmaker</th><th>Messages</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/admin/reserve/${r.id}`}>{r.first_name || 'Member'}</Link>{r.neighborhood && <span className="small muted"> · {r.neighborhood}</span>}</td>
                    <td>{r.band ? <span style={{ color: BANDS[r.band].color }}>{BANDS[r.band].label}</span> : '—'}</td>
                    <td>
                      <form action={assignMatchmaker} className="row" style={{ gap: 6 }}>
                        <input type="hidden" name="member" value={r.id} />
                        <select className="input" name="matchmaker" defaultValue={r.matchmaker_id ?? ''} style={{ minWidth: 140 }}>
                          <option value="">Not assigned</option>
                          {list.filter((m) => m.active || m.id === r.matchmaker_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <button className="btn ghost sm">Save</button>
                      </form>
                    </td>
                    <td className="small">{r.waiting > 0 ? <span style={{ color: 'var(--gold)' }}>{r.waiting} waiting</span> : <span className="muted">Last {ago(r.last_at)}</span>}</td>
                    <td><Link className="btn ghost sm" href={`/admin/reserve/${r.id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="matchmakers" className="card stack" style={{ gap: 14 }}>
        <strong>Matchmakers</strong>
        <span className="small muted">Members see the name, photo, bio and booking link. They reach the matchmaker by messaging in ScoreDate or at the email shown, so no one’s personal inbox is exposed.</span>
        {list.map((m) => (
          <details key={m.id} className="card" style={{ background: 'var(--onyx)' }}>
            <summary style={{ cursor: 'pointer' }}><strong>{m.name}</strong> <span className="small muted">{m.active ? '' : '· inactive'} {m.booking_url ? '' : '· no booking link'}</span></summary>
            <div style={{ marginTop: 12 }}>{owner ? <MatchmakerForm m={m} /> : <span className="small muted">Only owners can edit matchmakers.</span>}</div>
          </details>
        ))}
        {owner && (
          <details className="card" style={{ background: 'var(--onyx)' }} open={list.length === 0}>
            <summary style={{ cursor: 'pointer' }}><strong>Add a matchmaker</strong></summary>
            <div style={{ marginTop: 12 }}><MatchmakerForm /></div>
          </details>
        )}
      </section>
    </>
  );
}
