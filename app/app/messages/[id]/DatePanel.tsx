'use client';
import { useState } from 'react';
import { proposeDate, respondDate, revokeShare, setReservation, shareDate, submitDateChallenge } from '../../features';
import PlaceFields from '@/components/PlaceFields';
import PlaceDetails from '@/components/PlaceDetails';

export type Plan = { id: string; proposer_id: string; place: string; address: string | null; starts_at: string; note: string | null; status: 'proposed' | 'accepted' | 'declined' | 'cancelled'; place_id?: string | null; lat?: number | null; lng?: number | null; budget_challenge?: boolean;
  reservation_by?: string | null; reservation_at?: string | null; reservation_name?: string | null; reservation_party?: number | null; reservation_conf?: string | null; reservation_note?: string | null };

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function gcal(p: Plan) {
  const start = new Date(p.reservation_at || p.starts_at);
  const end = new Date(start.getTime() + 2 * 3600000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `Date at ${p.place}`, dates: `${f(start)}/${f(end)}`, location: [p.place, p.address].filter(Boolean).join(', '), details: 'Planned on ScoreDate' });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function Hidden({ v }: { v: Record<string, string> }) {
  return <>{Object.entries(v).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}</>;
}

export default function DatePanel({ conversationId, meId, otherName, plan, shareUrl, justShared }: {
  conversationId: string; meId: string; otherName: string; plan: Plan | null; shareUrl: string | null; justShared: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pickedPlace, setPickedPlace] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [copied, setCopied] = useState(false);
  const tz = String(new Date().getTimezoneOffset());
  const minLocal = new Date(Date.now() + 60 * 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  async function shareLink() {
    if (!shareUrl) return;
    const text = `I'm on a date. Here are the details, just in case: ${shareUrl}`;
    if (navigator.share) { try { await navigator.share({ title: 'My date plan', text, url: shareUrl }); return; } catch { /* fall through */ } }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  if (plan) {
    const mine = plan.proposer_id === meId;
    const ids = { conversation_id: conversationId, plan_id: plan.id };
    return (
      <div className="card gold stack" style={{ gap: 10 }}>
        <span className="label">{plan.status === 'accepted' ? 'Date confirmed' : mine ? `Waiting on ${otherName}` : `${otherName} suggested a date`}</span>
        <span className="serif" style={{ fontSize: 24 }}>{plan.place}</span>
        {plan.budget_challenge && <span className="chip small" style={{ alignSelf: 'flex-start', color: 'var(--rise)', borderColor: 'var(--rise-line)' }}>$50 Date Challenge</span>}
        <span className="small">{fmt(plan.starts_at)}{plan.address ? ` · ${plan.address}` : ''}</span>
        {plan.place_id && <PlaceDetails placeId={plan.place_id} on={plan.starts_at} />}
        {plan.note && <span className="small muted">“{plan.note}”</span>}

        {plan.status === 'proposed' && !mine && (
          <div className="row" style={{ gap: 8 }}>
            <form action={respondDate} className="grow"><Hidden v={{ ...ids, status: 'accepted' }} /><button className="btn block">Sounds good</button></form>
            <form action={respondDate}><Hidden v={{ ...ids, status: 'declined' }} /><button className="btn ghost">Not this time</button></form>
          </div>
        )}

        {plan.status === 'accepted' && (
          <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
            <span className="small" style={{ fontWeight: 600 }}>Reservation</span>
            {plan.reservation_at ? (
              <div className="stack" style={{ gap: 4 }}>
                <span className="small">{fmt(plan.reservation_at)} · table for {plan.reservation_party || 2}{plan.reservation_name ? ` under ${plan.reservation_name}` : ''}</span>
                {plan.reservation_conf && <span className="small">Confirmation <span className="mono">{plan.reservation_conf}</span></span>}
                {plan.reservation_note && <span className="small muted">{plan.reservation_note}</span>}
                <span className="small muted">Shared by {plan.reservation_by === meId ? 'you' : otherName}.</span>
                <form action={setReservation}><Hidden v={{ ...ids, clear: '1' }} /><button className="btn ghost sm">Remove reservation</button></form>
              </div>
            ) : booking ? (
              <form action={setReservation} className="stack" style={{ gap: 8 }}>
                <Hidden v={{ ...ids, tz_offset: tz }} />
                <label className="field">Time<input className="input" type="datetime-local" name="reservation_at" defaultValue={new Date(new Date(plan.starts_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} /></label>
                <div className="row" style={{ gap: 8 }}>
                  <label className="field grow">Name it’s under<input className="input" name="name" maxLength={60} /></label>
                  <label className="field" style={{ width: 90 }}>Party<input className="input" name="party" type="number" min={1} max={20} defaultValue={2} /></label>
                </div>
                <label className="field">Confirmation # (optional)<input className="input" name="conf" maxLength={60} /></label>
                <label className="field">Note (optional)<input className="input" name="note" maxLength={200} placeholder="Bar seats, ask for the patio" /></label>
                <div className="row" style={{ gap: 8 }}><button className="btn sm grow">Share with {otherName}</button><button type="button" className="btn ghost sm" onClick={() => setBooking(false)}>Cancel</button></div>
              </form>
            ) : (
              <button type="button" className="btn ghost sm" onClick={() => setBooking(true)}>I booked a table</button>
            )}
            <span className="small" style={{ fontWeight: 600, marginTop: 4 }}>Calendar</span>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <a className="btn ghost sm" href={`/app/dates/${plan.id}/ics`}>Add to my calendar</a>
              <a className="btn ghost sm" target="_blank" rel="noopener noreferrer" href={gcal(plan)}>Google Calendar ↗</a>
            </div>
            <span className="small muted">Only adds it to your calendar. {otherName} can add it to theirs from here too.</span>
          </div>
        )}

        {plan.status === 'accepted' && plan.budget_challenge && new Date(plan.starts_at).getTime() < Date.now() && (
          <details className="stack" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
            <summary className="small" style={{ fontWeight: 600, cursor: 'pointer' }}>How was your $50 date? Share it</summary>
            <form action={submitDateChallenge} className="stack" style={{ gap: 8, marginTop: 10 }}>
              <Hidden v={ids} />
              <label className="field">Give it a title<input className="input" name="title" required minLength={3} maxLength={80} placeholder="Dumplings, then the High Line at sunset" /></label>
              <label className="field">What you spent<input className="input" name="spent" required inputMode="decimal" placeholder="$38" /></label>
              <label className="field">What made it great<textarea className="input" name="story" required minLength={10} maxLength={1000} rows={3} /></label>
              <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="share_ok" style={{ accentColor: 'var(--gold)', marginTop: 4 }} /><span className="small">ScoreDate can feature this (first names only, never photos or last names)</span></label>
              <button className="btn sm" data-haptic="success">Share</button>
            </form>
          </details>
        )}

        {plan.status === 'accepted' && (
          <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
            <span className="small" style={{ fontWeight: 600 }}>Safety</span>
            {shareUrl ? (
              <>
                <span className="small muted">{justShared ? 'Link ready. ' : ''}Send this private link to a friend. It shows the place, time and {otherName}&apos;s first name, plus your check-in after the date. It expires the day after.</span>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn sm grow" onClick={shareLink}>{copied ? 'Link copied' : 'Send to a friend'}</button>
                  <form action={revokeShare}><Hidden v={ids} /><button className="btn ghost sm">Turn off link</button></form>
                </div>
              </>
            ) : (
              <form action={shareDate} className="row" style={{ gap: 8 }}>
                <Hidden v={ids} />
                <input className="input grow" name="friend" placeholder="Friend's name (optional)" maxLength={60} style={{ padding: '8px 12px' }} />
                <button className="btn sm">Share my plan</button>
              </form>
            )}
            <span className="small muted">Meet in public, tell someone where you&apos;ll be, and get yourself home. In an emergency, call 911.</span>
          </div>
        )}

        {(mine || plan.status === 'accepted') && (
          <form action={respondDate}><Hidden v={{ ...ids, status: 'cancelled' }} /><button className="btn ghost sm">{plan.status === 'accepted' ? 'Cancel date' : 'Withdraw'}</button></form>
        )}
      </div>
    );
  }

  return open ? (
    <form action={proposeDate} className="card stack" style={{ gap: 10 }}>
      <Hidden v={{ conversation_id: conversationId, tz_offset: tz }} />
      <span className="label">Suggest a date</span>
      <PlaceFields compact nameField="place" nameLabel="Where" namePlaceholder="Search restaurants, bars, places" addressLabel="Address (optional)" addressPlaceholder="52 Grove St" onPick={setPickedPlace} />
      {pickedPlace && <PlaceDetails placeId={pickedPlace} compact />}
      <label className="field">When<input className="input" type="datetime-local" name="starts_at" required min={minLocal} /></label>
      <label className="field">Note (optional)<input className="input" name="note" maxLength={300} placeholder="Drinks after work?" /></label>
      <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="budget_challenge" style={{ accentColor: 'var(--gold)', marginTop: 4 }} /><span className="stack" style={{ gap: 2 }}><strong>Make it a $50 Date Challenge</strong><span className="small muted">Plan the best date you can for under $50, then share how it went.</span></span></label>
      <span className="small muted">Pick somewhere public for a first date.</span>
      <div className="row" style={{ gap: 8 }}><button className="btn grow">Send suggestion</button><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  ) : (
    <button type="button" className="btn ghost block" onClick={() => setOpen(true)}>Suggest a date</button>
  );
}
