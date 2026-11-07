'use client';
import { useState } from 'react';
import { proposeDate, respondDate, revokeShare, shareDate } from '../../features';

export type Plan = { id: string; proposer_id: string; place: string; address: string | null; starts_at: string; note: string | null; status: 'proposed' | 'accepted' | 'declined' | 'cancelled' };

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Hidden({ v }: { v: Record<string, string> }) {
  return <>{Object.entries(v).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}</>;
}

export default function DatePanel({ conversationId, meId, otherName, plan, shareUrl, justShared }: {
  conversationId: string; meId: string; otherName: string; plan: Plan | null; shareUrl: string | null; justShared: boolean;
}) {
  const [open, setOpen] = useState(false);
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
        <span className="small">{fmt(plan.starts_at)}{plan.address ? ` · ${plan.address}` : ''}</span>
        {plan.address && <a className="small" href={`https://maps.apple.com/?q=${encodeURIComponent(`${plan.place} ${plan.address}`)}`} target="_blank" rel="noopener noreferrer">Open in Maps ↗</a>}
        {plan.note && <span className="small muted">“{plan.note}”</span>}

        {plan.status === 'proposed' && !mine && (
          <div className="row" style={{ gap: 8 }}>
            <form action={respondDate} className="grow"><Hidden v={{ ...ids, status: 'accepted' }} /><button className="btn block">Sounds good</button></form>
            <form action={respondDate}><Hidden v={{ ...ids, status: 'declined' }} /><button className="btn ghost">Not this time</button></form>
          </div>
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
      <label className="field">Where<input className="input" name="place" required maxLength={120} placeholder="Bar Pisellino" /></label>
      <label className="field">Address (optional)<input className="input" name="address" maxLength={200} placeholder="52 Grove St" /></label>
      <label className="field">When<input className="input" type="datetime-local" name="starts_at" required min={minLocal} /></label>
      <label className="field">Note (optional)<input className="input" name="note" maxLength={300} placeholder="Drinks after work?" /></label>
      <span className="small muted">Pick somewhere public for a first date.</span>
      <div className="row" style={{ gap: 8 }}><button className="btn grow">Send suggestion</button><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  ) : (
    <button type="button" className="btn ghost block" onClick={() => setOpen(true)}>Suggest a date</button>
  );
}
