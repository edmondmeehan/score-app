import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { BANDS } from '@/lib/types';
import type { EventRow } from '@/lib/events';
import { announceEvent, saveEvent } from '../actions';

export const dynamic = 'force-dynamic';

const nyLocal = (iso: string | null) => {
  if (!iso) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

type Rsvp = { user_id: string; name: string | null; plan: string; band: keyof typeof BANDS | null; status: string; at: string };

export default async function EditEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; sent?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const isNew = id === 'new';
  const { data } = isNew ? { data: null } : await supabase.from('events').select('*').eq('id', id).maybeSingle();
  const e = data as EventRow | null;
  if (!isNew && !e) notFound();
  const { data: rsvps } = e ? await supabase.rpc('staff_event_rsvps', { p_event: e.id }) : { data: [] };
  const list = (rsvps as Rsvp[]) || [];
  const going = list.filter((r) => r.status === 'going').length;

  return (
    <>
      <div className="row"><Link href="/admin/events" className="small">‹ Events</Link></div>
      <h1 className="serif" style={{ fontSize: 40 }}>{isNew ? 'New event' : e!.title}</h1>
      {sp.error && <div className="notice error">{sp.error}</div>}
      {sp.saved && <div className="notice">Saved.</div>}
      {sp.sent && <div className="notice">Announcement: {sp.sent}.</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <form action={saveEvent} className="card stack" style={{ flex: '2 1 420px' }}>
          <input type="hidden" name="id" value={e?.id || ''} />
          <label className="field">Title<input className="input" name="title" required maxLength={100} defaultValue={e?.title} placeholder="Rooftop supper club" /></label>
          <label className="field">Description<textarea className="input" name="description" rows={5} maxLength={2000} defaultValue={e?.description || ''} placeholder="What to expect, dress code, who's hosting." /></label>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="field grow">Venue<input className="input" name="venue" required maxLength={120} defaultValue={e?.venue} /></label>
            <label className="field grow">Address (members see it after RSVP)<input className="input" name="address" maxLength={200} defaultValue={e?.address || ''} /></label>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="field grow">Starts (New York time)<input className="input" type="datetime-local" name="starts_at" required defaultValue={nyLocal(e?.starts_at || null)} /></label>
            <label className="field grow">Ends (optional)<input className="input" type="datetime-local" name="ends_at" defaultValue={nyLocal(e?.ends_at || null)} /></label>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="field" style={{ width: 120 }}>Capacity<input className="input" type="number" name="capacity" min={1} max={2000} defaultValue={e?.capacity ?? 40} /></label>
            <label className="field" style={{ width: 170 }}>Reserve first (hours)<input className="input" type="number" name="black_priority_hours" min={0} max={336} defaultValue={e?.black_priority_hours ?? 48} /></label>
            <label className="field grow">Price note<input className="input" name="price_note" maxLength={80} defaultValue={e?.price_note || ''} placeholder="Free for members" /></label>
          </div>
          <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="founders_only" defaultChecked={Boolean(e?.founders_only)} style={{ accentColor: 'var(--gold)', marginTop: 4, width: 18, height: 18 }} /><span className="stack" style={{ gap: 2 }}><strong>Founding Members only</strong><span className="small muted">Only members with the Founding Member badge can RSVP. Others see it but can’t join.</span></span></label>
          <label className="field">Area<input className="input" name="area" defaultValue={e?.area || 'New York City'} /></label>
          <label className="field">Status
            <select className="input" name="status" defaultValue={e?.status || 'draft'}>
              <option value="draft">Draft (hidden)</option><option value="published">Published (members can see and RSVP)</option><option value="cancelled">Cancelled</option>
            </select>
          </label>
          <button className="btn">Save event</button>
          <span className="small muted">Reserve members can RSVP as soon as you publish. Everyone else can RSVP once the Reserve-first window ends.</span>
        </form>

        {e && (
          <section className="stack" style={{ flex: '1 1 300px', gap: 20 }}>
            <form action={announceEvent} className="card stack">
              <h2 style={{ margin: 0, fontSize: 16 }}>Announce by email</h2>
              <span className="small muted">Emails members who have event emails on. During the Reserve-first window it goes to Reserve members only; send again after it ends to reach everyone.</span>
              <input type="hidden" name="id" value={e.id} />
              <button className="btn ghost sm" disabled={e.status !== 'published'}>Send announcement</button>
            </form>
            <div className="card stack">
              <h2 style={{ margin: 0, fontSize: 16 }}>RSVPs · {going} / {e.capacity}</h2>
              {list.length === 0 && <span className="small muted">No RSVPs yet.</span>}
              {list.map((r) => (
                <div key={r.user_id} className="row small" style={{ justifyContent: 'space-between' }}>
                  <Link href={`/admin/members/${r.user_id}`}>{r.name || 'Member'}</Link>
                  <span className="muted">{r.plan}{r.band ? ` · ${BANDS[r.band].label}` : ''}</span>
                  <span style={{ color: r.status === 'going' ? 'var(--rise)' : r.status === 'waitlist' ? 'var(--gold)' : 'var(--muted)' }}>{r.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
