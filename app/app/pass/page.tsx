import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { photoUrls } from '@/lib/photos';
import { BANDS } from '@/lib/types';
import MemberPass from '@/components/MemberPass';
import FounderBadge from '@/components/FounderBadge';
import { age } from '@/components/ui';

export const dynamic = 'force-dynamic';

const PLAN: Record<string, string> = { preview: 'Preview', membership: 'Member', premium: 'Premium', black: 'Reserve' };

/** Member pass: a QR that changes every 30 seconds, for event check-in and partner perks. */
export default async function Pass({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const photo = (await photoUrls(supabase, [me.id]))[me.id]?.[0];
  const { data: ev } = sp.event && /^[0-9a-f-]{36}$/.test(sp.event) ? await supabase.from('events').select('id, title, venue, starts_at').eq('id', sp.event).maybeSingle() : { data: null };
  const b = me.band ? BANDS[me.band] : null;
  return (
    <div className="phone" style={{ gap: 18 }}>
      <Link href={ev ? `/app/events/${ev.id}` : '/app/settings'} className="small muted">‹ Back</Link>
      <div className="pass-card">
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <div className="pass-photo">{photo ? <img src={photo} alt="" /> : <span className="serif">{me.first_name?.[0]}</span>}</div>
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <span className="eyebrow" style={{ margin: 0 }}>ScoreDate member pass</span>
            <span className="serif" style={{ fontSize: 30, lineHeight: 1 }}>{me.first_name} <span className="muted" style={{ fontSize: 18 }}>{age(me.birth_year)}</span></span>
            <span className="row small" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span>{PLAN[me.plan] || 'Member'}</span>
              {b && <span style={{ color: b.color }}>· {b.label}</span>}
              {me.id_status === 'approved' && <span style={{ color: 'var(--rise)' }}>· ID verified</span>}
            </span>
            {me.is_founder && <FounderBadge />}
          </div>
        </div>
        {ev && <div className="pass-event"><span className="small muted">Checking in to</span><strong>{ev.title}</strong><span className="small muted">{ev.venue}</span></div>}
        <MemberPass />
        <span className="small muted" style={{ textAlign: 'center' }}>Show this to the host at ScoreDate events and partner venues. Turn your screen brightness up if it won’t scan.</span>
      </div>
    </div>
  );
}
