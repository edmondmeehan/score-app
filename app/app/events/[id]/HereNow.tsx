'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { eventHere, hideHere, setInterest, waveAt, type HereData, type HerePerson } from '../../features';
import { haptic } from '@/lib/haptics';

export type Here = HereData;

const HELLOS = ['Hi! Want to say hello?', 'I’m here too. Come find me?', 'Grab a drink at the bar?'];

function Heart({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 21s-7.5-4.6-9.5-9.4C1.2 8.3 3.4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.6 0 5.8 3.8 4.5 7.1C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

/**
 * One person. "Interested" is private (they only find out if it's mutual, which opens a chat).
 * During the event you can also "Say hi" with a short message to meet up.
 */
function Person({ p, eventId, live, left, onChange }: { p: HerePerson; eventId: string; live: boolean; left: number; onChange: (id: string, patch: Partial<HerePerson>) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(HELLOS[0]);
  const [where, setWhere] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [justMatched, setJustMatched] = useState(false);
  const sent = p.waved;

  async function toggleInterest() {
    const on = !p.interested;
    onChange(p.id, { interested: on });
    haptic(on ? 'medium' : 'selection');
    const r = await setInterest(eventId, p.id, on).catch(() => ({ ok: false, error: 'Something went wrong' } as { ok: boolean; error?: string; mutual?: boolean; conversationId?: string | null }));
    if (!r.ok) { onChange(p.id, { interested: !on }); setErr(r.error || 'Couldn’t save'); return; }
    if (r.mutual) { haptic('success'); setJustMatched(true); onChange(p.id, { mutual: true, conversation_id: r.conversationId || p.conversation_id }); }
  }

  async function send() {
    setBusy(true); setErr(null);
    const msg = where.trim() ? `${text.trim()} I’m ${where.trim()}.` : text.trim();
    const r = await waveAt(eventId, p.id, msg).catch(() => ({ ok: false, error: 'Something went wrong. Try again.' } as { ok: boolean; error?: string; conversationId?: string }));
    setBusy(false);
    if (!r.ok || !r.conversationId) { setErr(r.error || 'Couldn’t send'); haptic('warning'); return; }
    haptic('success'); setOpen(false); onChange(p.id, { waved: true, conversation_id: r.conversationId });
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 12 }}>
        <span className="avatar" style={{ width: 48, height: 48 }}>{p.photo ? <img src={p.photo} alt="" /> : p.first_name?.[0]}</span>
        <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <strong>{p.first_name}{p.age ? `, ${p.age}` : ''}</strong>
          <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.mutual ? <span style={{ color: 'var(--gold-light)' }}>You both want to meet</span> : p.waved_me && !sent ? 'Said hi to you' : p.job || 'Verified member'}
          </span>
        </span>
        {p.mutual && p.conversation_id ? (
          <Link href={`/app/messages/${p.conversation_id}`} className="btn sm">Chat</Link>
        ) : (
          <>
            <button type="button" className="btn ghost sm" onClick={toggleInterest} aria-pressed={Boolean(p.interested)}
              aria-label={p.interested ? `Interested in ${p.first_name}. Tap to undo` : `Interested in ${p.first_name}`}
              style={{ width: 44, padding: 0, color: p.interested ? 'var(--gold-light)' : undefined }}><Heart on={Boolean(p.interested)} /></button>
            {live && (sent && p.conversation_id
              ? <button type="button" className="btn ghost sm" onClick={() => router.push(`/app/messages/${p.conversation_id}`)}>Chat</button>
              : <button type="button" className="btn ghost sm" onClick={() => { setOpen((o) => !o); haptic('selection'); }} aria-expanded={open}>Say hi</button>)}
          </>
        )}
      </div>
      {justMatched && (
        <div className="notice small" role="status">You both want to meet. {p.conversation_id ? <Link href={`/app/messages/${p.conversation_id}`}>Say hi now</Link> : 'Check your messages.'}</div>
      )}
      {open && !sent && live && (
        <div className="card stack" style={{ gap: 8, padding: 12 }}>
          {p.conversation_id && <Link href={`/app/messages/${p.conversation_id}`} className="small">You’re already chatting. Open the chat</Link>}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {HELLOS.map((h) => <button key={h} type="button" className="chip" onClick={() => setText(h)} style={text === h ? { borderColor: 'var(--gold)', color: 'var(--gold-light)' } : undefined}>{h}</button>)}
          </div>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={140} aria-label="Your message" />
          <input className="input" value={where} onChange={(e) => setWhere(e.target.value)} maxLength={50} placeholder="Where you are (optional): by the bar, blue jacket" aria-label="Where you are" />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small muted">{left} hello{left === 1 ? '' : 's'} left tonight</span>
            <button type="button" className="btn sm" disabled={busy || !text.trim() || left < 1} onClick={send}>{busy ? 'Sending…' : `Send to ${p.first_name}`}</button>
          </div>
        </div>
      )}
      {err && <div className="notice error small">{err}</div>}
    </div>
  );
}

/**
 * Who's going (from 24 hours before) and Who's here (once the event is live and you're scanned in).
 * Hearts are private until mutual. Refreshes every 20 seconds during the event, every 2 minutes before it.
 */
export default function HereNow({ eventId, initial, going }: { eventId: string; initial: Here; going: boolean }) {
  const [d, setD] = useState<Here>(initial);
  const mode = d?.mode ?? (d?.live ? 'live' : null);
  useEffect(() => {
    if (!mode) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') eventHere(eventId).then((x) => x && setD(x)).catch(() => null); }, mode === 'live' ? 20000 : 120000);
    return () => clearInterval(t);
  }, [eventId, mode]);
  if (!d || !mode) return null;
  const live = mode === 'live';
  const isGoing = d.going ?? going;
  const matches = d.matches || [];
  const people = d.people || [];
  const left = d.waves_left ?? 5;
  const onChange = (id: string, patch: Partial<HerePerson>) => setD((cur) => cur && ({
    ...cur,
    waves_left: patch.waved ? Math.max(0, (cur.waves_left ?? 5) - 1) : cur.waves_left,
    people: (cur.people || []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
  }));
  const toggleHide = async () => { haptic('selection'); const x = await hideHere(eventId, !d.hidden).catch(() => null); if (x) setD(x); };
  const canSee = live ? d.me_here : isGoing;

  return (
    <section className="card gold stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row" style={{ gap: 8 }}>{live && <span className="live-dot" aria-hidden />}<strong>{live ? 'Who’s here' : 'Who’s going'}</strong></span>
        <span className="small muted">{live ? `${d.here || 0} checked in` : `${d.going_count || 0} going`}</span>
      </div>

      {live && !d.me_here && (
        <>
          <span className="small muted">{isGoing ? 'Show your member pass at the door. Once you’re scanned in, you’ll see who’s here and can say hi.' : 'Members are checking in now.'}</span>
          {isGoing && <Link href={`/app/pass?event=${eventId}`} className="btn sm" style={{ alignSelf: 'flex-start' }}>Show my pass</Link>}
        </>
      )}
      {!live && !isGoing && <span className="small muted">RSVP to see who else is going and tap who you’d like to meet.</span>}

      {live && d.me_here && matches.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="small">{matches.length === 1 ? 'Someone you’ve matched with is here' : `${matches.length} people you’ve matched with are here`}</span>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {matches.map((m) => (
              <Link key={m.id} href={`/app/messages/${m.conversation_id}`} className="stack" style={{ alignItems: 'center', gap: 4, textDecoration: 'none', color: 'inherit', width: 64 }}>
                <span className="avatar" style={{ width: 52, height: 52 }}>{m.photo ? <img src={m.photo} alt="" /> : m.first_name?.[0]}</span>
                <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 64 }}>{m.first_name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {canSee && !d.hidden && (
        people.length > 0 ? (
          <div className="stack" style={{ gap: 12 }}>
            <span className="small">{live ? 'Verified members here you could meet' : 'Verified members going you could meet'}</span>
            <span className="small muted" style={{ marginTop: -8 }}>Tap the heart if you’d like to meet. They only find out if they tap you too.</span>
            {people.map((p) => <Person key={p.id} p={p} eventId={eventId} live={live} left={left} onChange={onChange} />)}
          </div>
        ) : <span className="small muted">{live ? 'No one else you could match with has checked in yet. We’ll keep checking.' : 'No one else you could match with has RSVP’d yet. Check back closer to the night.'}</span>
      )}

      {canSee && (
        <div className="row" style={{ justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
          <span className="small muted">{d.hidden ? 'You’re hidden for this event.' : live ? 'Only checked-in members who match your preferences can see you here.' : 'Only members going who match your preferences can see you.'}</span>
          <button type="button" className="btn ghost sm" onClick={toggleHide}>{d.hidden ? 'Show me' : 'Hide me'}</button>
        </div>
      )}
    </section>
  );
}
