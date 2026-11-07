import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { when, type EventRow } from '@/lib/events';

export const dynamic = 'force-dynamic';

export default async function Events() {
  const { supabase, me } = await requireMember();
  const [{ data: events }, { data: mine }] = await Promise.all([
    supabase.from('events').select('*').in('status', ['published', 'cancelled']).gte('starts_at', new Date(Date.now() - 6 * 3600000).toISOString()).order('starts_at'),
    supabase.from('event_rsvps').select('event_id, status').eq('user_id', me.id),
  ]);
  const rsvp = Object.fromEntries((mine || []).map((r) => [r.event_id, r.status]));
  const list = (events as EventRow[]) || [];
  return (
    <div className="phone">
      <span className="eyebrow">Members only</span>
      <h1 className="serif" style={{ fontSize: 40 }}>Events</h1>
      <span className="muted small">Small, hosted nights in the city. Reserve members get first access. <Link href="/app/map">See where members are</Link>.</span>
      {list.length === 0 && (
        <div className="card stack" style={{ textAlign: 'center', padding: 32 }}>
          <span className="serif" style={{ fontSize: 24 }}>Nothing on the calendar yet</span>
          <span className="small muted">We&apos;ll email you when the next one opens.</span>
        </div>
      )}
      <div className="stack">
        {list.map((e) => {
          const early = e.published_at && new Date(e.published_at).getTime() + e.black_priority_hours * 3600000 > Date.now();
          const r = rsvp[e.id];
          return (
            <Link key={e.id} href={`/app/events/${e.id}`} className="card stack" style={{ textDecoration: 'none', color: 'inherit', gap: 6 }}>
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span className="mono small" style={{ color: 'var(--gold-light)' }}>{when(e.starts_at)}</span>
                {e.status === 'cancelled' ? <span className="small" style={{ color: '#E58A7A' }}>Cancelled</span>
                  : r === 'going' ? <span className="small" style={{ color: '#7FC29B' }}>Going</span>
                  : r === 'waitlist' ? <span className="small muted">Waitlist</span>
                  : early ? <span className="chip" style={{ fontSize: 11, padding: '2px 8px' }}>Reserve first</span> : null}
              </span>
              <span className="serif" style={{ fontSize: 24 }}>{e.title}</span>
              <span className="small muted">{e.venue}{e.price_note ? ` · ${e.price_note}` : ''}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
