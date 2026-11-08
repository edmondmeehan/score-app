import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { countdown, dayParts, eventImage, timeOnly, type EventRow } from '@/lib/events';
import { getReserveVisible } from '@/lib/reserve';

export const dynamic = 'force-dynamic';

export default async function Events() {
  const { supabase, me } = await requireMember();
  const [{ data: events }, { data: mine }, { data: countData }] = await Promise.all([
    supabase.from('events').select('*').in('status', ['published', 'cancelled']).gte('starts_at', new Date(Date.now() - 6 * 3600000).toISOString()).order('starts_at'),
    supabase.from('event_rsvps').select('event_id, status').eq('user_id', me.id),
    supabase.rpc('event_going_counts'),
  ]);
  const reserve = me.plan === 'black' || (await getReserveVisible(supabase));
  const rsvp = Object.fromEntries((mine || []).map((r) => [r.event_id, r.status]));
  const counts = (countData as Record<string, number>) || {};
  const list = (events as EventRow[]) || [];
  const [next, ...rest] = list;

  const badge = (e: EventRow) => {
    const early = e.published_at && new Date(e.published_at).getTime() + e.black_priority_hours * 3600000 > Date.now();
    const r = rsvp[e.id];
    return e.status === 'cancelled' ? <span className="event-chip" style={{ color: 'var(--alert)' }}>Cancelled</span>
      : r === 'going' ? <span className="event-chip go">Going</span>
      : r === 'waitlist' ? <span className="event-chip">Waitlist</span>
      : e.founders_only ? <span className="event-chip gold">Founding Members</span>
      : early ? <span className="event-chip">{reserve ? 'Reserve first' : 'Opening soon'}</span> : null;
  };

  return (
    <div className="phone">
      <span className="eyebrow">Members only</span>
      <h1 className="serif" style={{ fontSize: 40 }}>Events</h1>
      <span className="muted small">Small, hosted nights in the city.{reserve ? ' Reserve members get first access.' : ''} <Link href="/app/map">See where members are</Link>.</span>
      {list.length === 0 && (
        <div className="card stack" style={{ textAlign: 'center', padding: 32 }}>
          <span className="serif" style={{ fontSize: 24 }}>Nothing on the calendar yet</span>
          <span className="small muted">We&apos;ll email you when the next one opens.</span>
        </div>
      )}

      {next && (() => {
        const img = eventImage(next.image_path); const n = counts[next.id] || 0; const left = Math.max(0, next.capacity - n);
        return (
          <Link href={`/app/events/${next.id}`} className={`event-feature${img ? '' : ' no-img'}`} style={img ? { backgroundImage: `url("${img}")` } : undefined}>
            <div className="event-hero-shade" />
            <div className="event-hero-body">
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className="event-chip gold">{next.status === 'cancelled' ? 'Cancelled' : countdown(next.starts_at, next.ends_at)}</span>{badge(next)}</div>
              <span className="serif" style={{ fontSize: 32, lineHeight: 1.02 }}>{next.title}</span>
              <span className="small" style={{ opacity: 0.85 }}>{dayParts(next.starts_at).weekday} {dayParts(next.starts_at).month} {dayParts(next.starts_at).day} · {timeOnly(next.starts_at)} · {next.venue}</span>
              <span className="small" style={{ opacity: 0.85 }}>{n} going · {left > 0 ? `${left} spots left` : 'Waitlist open'}</span>
            </div>
          </Link>
        );
      })()}

      {rest.length > 0 && <span className="eyebrow" style={{ marginTop: 6 }}>Coming up</span>}
      <div className="stack" style={{ gap: 12 }}>
        {rest.map((e) => {
          const img = eventImage(e.image_path); const d = dayParts(e.starts_at); const n = counts[e.id] || 0;
          return (
            <Link key={e.id} href={`/app/events/${e.id}`} className="event-row">
              <div className={`event-thumb${img ? '' : ' no-img'}`} style={img ? { backgroundImage: `url("${img}")` } : undefined}>
                <span className="mono">{d.month}</span><strong className="serif">{d.day}</strong>
              </div>
              <div className="stack" style={{ gap: 4, minWidth: 0, flex: 1 }}>
                <span className="row" style={{ justifyContent: 'space-between', gap: 8 }}><span className="mono small" style={{ color: 'var(--gold-light)' }}>{d.weekday} · {timeOnly(e.starts_at)}</span>{badge(e)}</span>
                <span className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>{e.title}</span>
                <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.venue} · {n} going{e.price_note ? ` · ${e.price_note}` : ''}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
