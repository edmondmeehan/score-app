import Link from 'next/link';
import FounderBadge from '@/components/FounderBadge';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { rsvp } from '../../features';
import { when, type EventRow } from '@/lib/events';

export const dynamic = 'force-dynamic';

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  const e = data as EventRow | null;
  if (!e || e.status === 'draft') notFound();
  const [{ data: mine }, { data: counts }] = await Promise.all([
    supabase.from('event_rsvps').select('status').eq('event_id', id).eq('user_id', me.id).maybeSingle(),
    supabase.rpc('event_counts', { p_event: id }),
  ]);
  const status = mine?.status as string | undefined;
  const going = counts?.going ?? 0;
  const left = Math.max(0, e.capacity - going);
  const opensAt = e.published_at ? new Date(new Date(e.published_at).getTime() + e.black_priority_hours * 3600000) : null;
  const early = !e.founders_only && opensAt && opensAt.getTime() > Date.now();
  const foundersLocked = Boolean(e.founders_only) && !me.is_founder;
  const member = ['membership', 'premium', 'black'].includes(me.plan);
  const started = new Date(e.starts_at).getTime() < Date.now();

  return (
    <div className="phone">
      <div className="row"><Link href="/app/events" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link><span className="eyebrow">Event</span></div>
      <span className="mono small" style={{ color: 'var(--gold-light)' }}>{when(e.starts_at)}{e.ends_at ? ` – ${new Date(e.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}` : ''}</span>
      <h1 className="serif" style={{ fontSize: 40 }}>{e.title}</h1>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {e.status === 'cancelled' && <div className="notice error">This event was cancelled.</div>}
      <div className="card stack" style={{ gap: 6 }}>
        <strong>{e.venue}</strong>
        {e.address && (status === 'going'
          ? <a className="small" href={`https://maps.apple.com/?q=${encodeURIComponent(`${e.venue} ${e.address}`)}`} target="_blank" rel="noopener noreferrer">{e.address} ↗</a>
          : <span className="small muted">Exact address shared once you&apos;re going.</span>)}
        <span className="small muted">{e.area}{e.price_note ? ` · ${e.price_note}` : ''}</span>
        <span className="small muted">{left > 0 ? `${left} of ${e.capacity} spots left` : `Full · ${counts?.waitlist ?? 0} on the waitlist`}</span>
      </div>
      {e.description && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{e.description}</p>}
      {e.founders_only && <div className="notice" style={{ borderColor: 'var(--gold)' }}><FounderBadge /> <span style={{ marginLeft: 6 }}>A Founding Members event.{foundersLocked ? ' Only members with the Founding Member badge can RSVP.' : ' You’re in.'}</span></div>}
      {early && <div className="notice test">Reserve members have first access until {opensAt!.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}.</div>}

      {e.status === 'published' && !started && (
        status === 'going' || status === 'waitlist' ? (
          <form action={rsvp} className="stack">
            <input type="hidden" name="event_id" value={e.id} /><input type="hidden" name="going" value="no" />
            <div className="notice" style={{ margin: 0 }}>{status === 'going' ? "You're going." : "You're on the waitlist. We'll move you in if a spot opens."}</div>
            <button className="btn ghost block">Cancel my RSVP</button>
          </form>
        ) : !member ? (
          <Link href="/plans" className="btn block">Become a member to RSVP</Link>
        ) : foundersLocked ? (
          <button className="btn block" disabled>Founding Members only</button>
        ) : early && me.plan !== 'black' ? (
          <button className="btn block" disabled>RSVPs open {opensAt!.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}</button>
        ) : (
          <form action={rsvp}><input type="hidden" name="event_id" value={e.id} /><input type="hidden" name="going" value="yes" /><button className="btn block">{left > 0 ? "RSVP · I'm in" : 'Join the waitlist'}</button></form>
        )
      )}
      <span className="small muted">Plans change: cancel any time so someone on the waitlist can go.</span>
    </div>
  );
}
