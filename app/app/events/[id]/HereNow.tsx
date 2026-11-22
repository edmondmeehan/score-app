'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { eventHere, hideHere, waveAt, type HereData, type HerePerson } from '../../features';
import { haptic } from '@/lib/haptics';

export type Here = HereData;

const HELLOS = ['Hi! Want to say hello?', 'I’m here too. Come find me?', 'Grab a drink at the bar?'];

/** One person in Who's here: tap to say hi with a short message, or open the chat if you're already talking. */
function Person({ p, eventId, left, onSent }: { p: HerePerson; eventId: string; left: number; onSent: (id: string, conv: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(HELLOS[0]);
  const [where, setWhere] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sent = p.waved;
  async function send() {
    setBusy(true); setErr(null);
    const msg = where.trim() ? `${text.trim()} I’m ${where.trim()}.` : text.trim();
    const r = await waveAt(eventId, p.id, msg).catch(() => ({ ok: false, error: 'Something went wrong. Try again.' } as { ok: boolean; error?: string; conversationId?: string }));
    setBusy(false);
    if (!r.ok || !r.conversationId) { setErr(r.error || 'Couldn’t send'); haptic('warning'); return; }
    haptic('success'); setOpen(false); onSent(p.id, r.conversationId);
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button type="button" className="row" onClick={() => { if (p.conversation_id && sent) { router.push(`/app/messages/${p.conversation_id}`); return; } setOpen((o) => !o); haptic('selection'); }}
        style={{ gap: 12, background: 'none', border: 0, padding: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }} aria-expanded={open}>
        <span className="avatar" style={{ width: 48, height: 48 }}>{p.photo ? <img src={p.photo} alt="" /> : p.first_name?.[0]}</span>
        <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <strong>{p.first_name}{p.age ? `, ${p.age}` : ''}</strong>
          <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.job || 'Verified member'}</span>
        </span>
        {p.waved_me && !sent ? <span className="your-turn">Said hi to you</span>
          : sent ? <span className="small muted">Sent · Open chat</span>
          : <span className="btn ghost sm" aria-hidden>Say hi</span>}
      </button>
      {open && !sent && (
        <div className="card stack" style={{ gap: 8, padding: 12 }}>
          {p.conversation_id && <Link href={`/app/messages/${p.conversation_id}`} className="small">You’re already chatting. Open the chat</Link>}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {HELLOS.map((h) => <button key={h} type="button" className={`chip${text === h ? ' on' : ''}`} onClick={() => setText(h)} style={text === h ? { borderColor: 'var(--gold)', color: 'var(--gold-light)' } : undefined}>{h}</button>)}
          </div>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={140} aria-label="Your message" />
          <input className="input" value={where} onChange={(e) => setWhere(e.target.value)} maxLength={50} placeholder="Where you are (optional): by the bar, blue jacket" aria-label="Where you are" />
          {err && <div className="notice error small">{err}</div>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small muted">{left} hello{left === 1 ? '' : 's'} left tonight</span>
            <button type="button" className="btn sm" disabled={busy || !text.trim() || left < 1} onClick={send}>{busy ? 'Sending…' : `Send to ${p.first_name}`}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * During an event: how many members are checked in, your matches who are here, and (once you're scanned in) everyone
 * else here you could meet, with a quick "say hi" that starts a chat. Refreshes every 20 seconds.
 */
export default function HereNow({ eventId, initial, going }: { eventId: string; initial: Here; going: boolean }) {
  const [d, setD] = useState<Here>(initial);
  useEffect(() => {
    if (!initial?.live) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') eventHere(eventId).then((x) => x && setD(x)).catch(() => null); }, 20000);
    return () => clearInterval(t);
  }, [eventId, initial?.live]);
  if (!d?.live) return null;
  const n = d.here || 0;
  const matches = d.matches || [];
  const people = d.people || [];
  const left = d.waves_left ?? 5;
  const onSent = (id: string, conv: string) => setD((cur) => cur && ({
    ...cur, waves_left: Math.max(0, (cur.waves_left ?? 5) - 1),
    people: (cur.people || []).map((p) => (p.id === id ? { ...p, waved: true, conversation_id: conv } : p)),
  }));
  const toggleHide = async () => { haptic('selection'); const x = await hideHere(eventId, !d.hidden).catch(() => null); if (x) setD(x); };

  return (
    <section className="card gold stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row" style={{ gap: 8 }}><span className="live-dot" aria-hidden /><strong>Who’s here</strong></span>
        <span className="small muted">{n} member{n === 1 ? '' : 's'} checked in</span>
      </div>

      {!d.me_here && (
        <>
          <span className="small muted">{going ? 'Show your member pass at the door. Once you’re scanned in, you’ll see who’s here and can say hi.' : 'Members are checking in now.'}</span>
          {going && <Link href={`/app/pass?event=${eventId}`} className="btn sm" style={{ alignSelf: 'flex-start' }}>Show my pass</Link>}
        </>
      )}

      {d.me_here && matches.length > 0 && (
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

      {d.me_here && !d.hidden && (
        people.length > 0 ? (
          <div className="stack" style={{ gap: 12 }}>
            <span className="small">Verified members here you could meet</span>
            {people.map((p) => <Person key={p.id} p={p} eventId={eventId} left={left} onSent={onSent} />)}
          </div>
        ) : <span className="small muted">No one else you could match with has checked in yet. We’ll keep checking.</span>
      )}

      {d.me_here && (
        <div className="row" style={{ justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
          <span className="small muted">{d.hidden ? 'You’re hidden from Who’s here tonight.' : 'Only checked-in members who match your preferences can see you here.'}</span>
          <button type="button" className="btn ghost sm" onClick={toggleHide}>{d.hidden ? 'Show me' : 'Hide me'}</button>
        </div>
      )}
    </section>
  );
}
