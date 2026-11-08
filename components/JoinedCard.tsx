'use client';
import ShareInvite from './ShareInvite';
import FounderBadge from './FounderBadge';
import { useEffect } from 'react';
import { trackLead } from './AdPixels';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app').replace(/\/$/, '');

export default function JoinedCard({ eventId, message, code, token, position, founder, founderReason }: { eventId?: string; message: string; code: string; token: string; position: number | null; founder: boolean; founderReason: string | null }) {
  const url = `${SITE}/?ref=${code}`;
  useEffect(() => { if (eventId) trackLead(eventId); }, [eventId]);
  return (
    <div className="card gold stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span className="eyebrow">You&apos;re on the list</span>
        {founder && <FounderBadge size="md" />}
      </div>
      {position ? <p className="serif" style={{ fontSize: 40, margin: 0, lineHeight: 1 }}>#{position.toLocaleString('en-US')} <span className="muted" style={{ fontSize: 18 }}>in line</span></p> : null}
      <p style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>
      <div className="stack" style={{ gap: 6 }}>
        <strong>Move up the list</strong>
        <span className="small muted">
          Every friend who joins with your link moves you up 5 spots.{' '}
          {founder
            ? founderReason === 'early' ? 'You got one of the first founding spots in your neighborhood: a badge on your profile, first in line for invites, and extra invites to bring friends.' : 'You’re a Founding Member.'
            : 'Bring 3 friends and you become a Founding Member: a badge on your profile, first in line for invites, and extra invites.'}
        </span>
      </div>
      <ShareInvite url={url} />
      <a href={`/w/${token}`} className="small" style={{ color: 'var(--gold)' }}>Check your spot any time →</a>
    </div>
  );
}
