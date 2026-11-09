'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { eventHere } from '../../features';

export type Here = { live: boolean; here?: number; me_here?: boolean; matches?: { id: string; first_name: string | null; conversation_id: string; photo?: string | null }[] } | null;

/** During an event: how many members have checked in, and (once you're checked in) which of your matches are here. Refreshes every 30s. */
export default function HereNow({ eventId, initial, going }: { eventId: string; initial: Here; going: boolean }) {
  const [d, setD] = useState<Here>(initial);
  useEffect(() => {
    if (!initial?.live) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') eventHere(eventId).then((x) => x && setD(x)).catch(() => null); }, 30000);
    return () => clearInterval(t);
  }, [eventId, initial?.live]);
  if (!d?.live) return null;
  const n = d.here || 0;
  const matches = d.matches || [];
  return (
    <section className="card gold stack" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row" style={{ gap: 8 }}><span className="live-dot" aria-hidden /><strong>Here now</strong></span>
        <span className="small muted">{n} member{n === 1 ? '' : 's'} checked in</span>
      </div>
      {d.me_here ? (
        matches.length > 0 ? (
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
            <span className="small muted">Only people you’ve matched with see that you’re here, and only once they’ve checked in too.</span>
          </div>
        ) : <span className="small muted">None of your matches have checked in yet. Say hi to someone new.</span>
      ) : (
        <span className="small muted">{going ? 'Show your member pass at the door to check in. Once you’re in, you’ll see which of your matches are here.' : 'Members are checking in now.'}</span>
      )}
      {going && !d.me_here && <Link href={`/app/pass?event=${eventId}`} className="btn sm" style={{ alignSelf: 'flex-start' }}>Show my pass</Link>}
    </section>
  );
}
