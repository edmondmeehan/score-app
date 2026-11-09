import Link from 'next/link';
import FounderBadge from '@/components/FounderBadge';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { getReserveVisible } from '@/lib/reserve';
import { getBasemap } from '@/lib/basemap';
import { rsvp } from '../../features';
import { approx, countdown, dayParts, eventImage, timeOnly, when, type EventRow } from '@/lib/events';
import EventMapAuto from '@/components/EventMapAuto';
import { BANDS, type Band } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Social = { going: number; waitlist: number; this_week: number; matches_going: number; bands: Partial<Record<Band, number>> | null };

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  const e = data as EventRow | null;
  if (!e || e.status === 'draft') notFound();
  const [{ data: mine }, { data: socialData }, tiles] = await Promise.all([
    supabase.from('event_rsvps').select('status').eq('event_id', id).eq('user_id', me.id).maybeSingle(),
    supabase.rpc('event_social', { p_event: id }),
    getBasemap(),
  ]);
  const social = (socialData as Social) || { going: 0, waitlist: 0, this_week: 0, matches_going: 0, bands: null };
  const status = mine?.status as string | undefined;
  const isGoing = status === 'going';
  const going = social.going ?? 0;
  const left = Math.max(0, e.capacity - going);
  const pct = Math.min(100, Math.round((going / Math.max(1, e.capacity)) * 100));
  const opensAt = e.published_at ? new Date(new Date(e.published_at).getTime() + e.black_priority_hours * 3600000) : null;
  const early = !e.founders_only && opensAt && opensAt.getTime() > Date.now();
  const foundersLocked = Boolean(e.founders_only) && !me.is_founder;
  const member = ['membership', 'premium', 'black'].includes(me.plan);
  const reserve = me.plan === 'black' || (await getReserveVisible(supabase));
  const started = new Date(e.starts_at).getTime() < Date.now();
  const img = eventImage(e.image_path);
  const d = dayParts(e.starts_at);
  const soon = countdown(e.starts_at, e.ends_at);
  // Exact pin only for people going; everyone else sees the neighborhood.
  const mapLat = isGoing ? e.lat : approx(e.lat);
  const mapLng = isGoing ? e.lng : approx(e.lng);
  const q = encodeURIComponent([e.venue, e.address].filter(Boolean).join(', '));
  const bandRows = social.bands ? (Object.keys(BANDS) as Band[]).filter((b) => social.bands![b]).map((b) => [b, social.bands![b]!] as const) : [];
  const bandTotal = bandRows.reduce((t, [, n]) => t + n, 0);

  return (
    <div className="phone">
      <div className={`event-hero${img ? '' : ' no-img'}`} style={img ? { backgroundImage: `url("${img}")` } : undefined}>
        <div className="event-hero-shade" />
        <Link href="/app/events" aria-label="Back to events" className="event-hero-back">‹</Link>
        <div className="event-hero-body">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="event-chip gold">{e.status === 'cancelled' ? 'Cancelled' : soon}</span>
            {e.founders_only && <span className="event-chip">Founding Members</span>}
            {isGoing && <span className="event-chip go">You’re going</span>}
          </div>
          <h1 className="serif" style={{ fontSize: 42, lineHeight: 1, margin: 0 }}>{e.title}</h1>
          <span className="small" style={{ opacity: 0.85 }}>{e.venue} · {e.area}</span>
        </div>
      </div>

      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {e.status === 'cancelled' && <div className="notice error">This event was cancelled.</div>}

      <div className="event-facts">
        <div className="event-date"><span className="mono">{d.month}</span><strong className="serif">{d.day}</strong><span className="mono">{d.weekday}</span></div>
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <strong>{timeOnly(e.starts_at)}{e.ends_at ? ` – ${timeOnly(e.ends_at)}` : ''}</strong>
          <span className="small muted">{[e.price_note, e.dress_code ? `Dress: ${e.dress_code}` : null, e.host ? `Hosted by ${e.host}` : null].filter(Boolean).join(' · ') || when(e.starts_at)}</span>
          {isGoing && <a className="small" href={`/app/events/${e.id}/ics`}>Add to calendar</a>}
        </div>
      </div>

      <section className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span><strong className="serif" style={{ fontSize: 30 }}>{going}</strong> <span className="muted">member{going === 1 ? '' : 's'} going</span></span>
          <span className="small muted">{left > 0 ? `${left} spot${left === 1 ? '' : 's'} left` : `Full · ${social.waitlist} waiting`}</span>
        </div>
        <div className="event-bar" aria-hidden><span style={{ width: `${pct}%` }} /></div>
        <div className="row small muted" style={{ gap: 14, flexWrap: 'wrap' }}>
          {social.matches_going > 0 && <span style={{ color: 'var(--gold-light)' }}>♥ {social.matches_going} of your matches {social.matches_going === 1 ? 'is' : 'are'} going</span>}
          {social.this_week > 0 && <span>+{social.this_week} this week</span>}
          {left > 0 && left <= Math.max(3, Math.round(e.capacity * 0.15)) && <span style={{ color: 'var(--alert)' }}>Almost full</span>}
        </div>
        {bandRows.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="small muted">Who’s going, by band</span>
            <div className="event-bands">{bandRows.map(([b, n]) => <span key={b} title={`${BANDS[b].label}: ${n}`} style={{ flex: n, background: BANDS[b].color }} />)}</div>
            <div className="row small" style={{ gap: 12, flexWrap: 'wrap' }}>{bandRows.map(([b, n]) => <span key={b} style={{ color: BANDS[b].color }}>{BANDS[b].label} {Math.round((n / bandTotal) * 100)}%</span>)}</div>
          </div>
        )}
      </section>

      {e.description && <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{e.description}</p>}

      <section className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong>{e.venue}</strong>
          {!isGoing && <span className="small muted">Exact spot after you RSVP</span>}
        </div>
        <EventMapAuto lat={mapLat ?? null} lng={mapLng ?? null} query={[e.venue, isGoing ? e.address : null, 'New York, NY'].filter(Boolean).join(', ')} exact={isGoing} label={e.venue} tiles={tiles} />
        {isGoing && e.address && (
          <div className="stack" style={{ gap: 4 }}>
            <span className="small">{e.address}</span>
            <span className="row small" style={{ gap: 14 }}>
              <a href={`https://maps.apple.com/?q=${encodeURIComponent(e.venue)}&address=${encodeURIComponent(e.address)}${e.lat != null ? `&ll=${e.lat},${e.lng}` : ''}`} target="_blank" rel="noopener noreferrer">Apple Maps ↗</a>
              <a href={`https://www.google.com/maps/search/?api=1&query=${q}${e.place_id ? `&query_place_id=${e.place_id}` : ''}`} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
            </span>
          </div>
        )}
      </section>

      {e.founders_only && <div className="notice" style={{ borderColor: 'var(--gold)' }}><FounderBadge /> <span style={{ marginLeft: 6 }}>A Founding Members event.{foundersLocked ? ' Only members with the Founding Member badge can RSVP.' : ' You’re in.'}</span></div>}
      {early && <div className="notice test">{reserve ? 'Reserve members have first access until ' : 'RSVPs open '}{opensAt!.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}.</div>}

      <div className="event-cta">
        {e.status === 'published' && !started && (
          status === 'going' || status === 'waitlist' ? (
            <form action={rsvp} className="stack" style={{ gap: 8 }}>
              <input type="hidden" name="event_id" value={e.id} /><input type="hidden" name="going" value="no" />
              <div className="notice" style={{ margin: 0 }}>{status === 'going' ? 'You’re going. See you there.' : 'You’re on the waitlist. We’ll move you in if a spot opens.'}</div>
              <button className="btn ghost block" data-haptic="medium">Cancel my RSVP</button>
            </form>
          ) : !member ? (
            <Link href="/plans" className="btn block">Become a member to RSVP</Link>
          ) : foundersLocked ? (
            <button className="btn block" disabled>Founding Members only</button>
          ) : early && me.plan !== 'black' ? (
            <button className="btn block" disabled>RSVPs open {opensAt!.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}</button>
          ) : (
            <form action={rsvp}><input type="hidden" name="event_id" value={e.id} /><input type="hidden" name="going" value="yes" /><button className="btn block" data-haptic="success">{left > 0 ? 'RSVP · I’m in' : 'Join the waitlist'}</button></form>
          )
        )}
        <span className="small muted" style={{ textAlign: 'center' }}>Plans change: cancel any time so someone on the waitlist can go.</span>
      </div>
    </div>
  );
}
