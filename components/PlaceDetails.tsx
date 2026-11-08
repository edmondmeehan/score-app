'use client';
import { useEffect, useState } from 'react';
import { loadPlaces } from './PlaceFields';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Info = {
  name: string; address: string | null; photos: { url: string; by: { name: string; uri?: string }[] }[];
  hours: string[] | null; openNow: boolean | null; website: string | null; mapsUrl: string | null; reservable: boolean | null; price: number | null;
};

const PRICE: Record<string, number> = { FREE: 0, INEXPENSIVE: 1, MODERATE: 2, EXPENSIVE: 3, VERY_EXPENSIVE: 4 };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Live Google place details for a date spot: photos, hours on the day of the date, website/menu and booking links.
 * Loaded fresh from Google each time (only the place ID is stored, per Google's terms). Renders nothing without a key.
 */
export default function PlaceDetails({ placeId, on, compact = false }: { placeId: string; on?: string | null; compact?: boolean }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const places = await loadPlaces();
        const p = new places.Place({ id: placeId });
        await p.fetchFields({ fields: ['displayName', 'formattedAddress', 'photos', 'regularOpeningHours', 'websiteURI', 'googleMapsURI', 'reservable', 'priceLevel', 'utcOffsetMinutes'] });
        let openNow: boolean | null = null;
        try { openNow = typeof p.isOpen === 'function' ? await p.isOpen() : null; } catch { openNow = null; }
        if (!live) return;
        setInfo({
          name: String(p.displayName || ''),
          address: p.formattedAddress ? String(p.formattedAddress).replace(/, USA$/, '') : null,
          photos: (p.photos || []).slice(0, compact ? 3 : 5).map((ph: any) => ({
            url: ph.getURI({ maxHeight: 400 }),
            by: (ph.authorAttributions || []).map((a: any) => ({ name: a.displayName, uri: a.uri })),
          })),
          hours: p.regularOpeningHours?.weekdayDescriptions || null,
          openNow,
          website: p.websiteURI || null,
          mapsUrl: p.googleMapsURI || null,
          reservable: typeof p.reservable === 'boolean' ? p.reservable : null,
          price: p.priceLevel != null ? (typeof p.priceLevel === 'number' ? p.priceLevel : PRICE[String(p.priceLevel)] ?? null) : null,
        });
      } catch { if (live) setFailed(true); }
    })();
    return () => { live = false; };
  }, [placeId, compact]);

  if (failed || !info) return failed ? null : <div className="small muted">Loading place details…</div>;

  // Hours for the day of the date (or today), from Google's "Monday: 5:00 PM – 12:00 AM" lines.
  const day = DAYS[(on ? new Date(on) : new Date()).getDay()];
  const dayLine = info.hours?.find((h) => h.startsWith(day));
  const credits = Array.from(new Map(info.photos.flatMap((p) => p.by).map((b) => [b.name, b])).values()).slice(0, 3);
  const q = encodeURIComponent(info.name);

  return (
    <div className="stack" style={{ gap: 10 }}>
      {info.photos.length > 0 && (
        <div className="place-photos" role="list" aria-label={`Photos of ${info.name}`}>
          {info.photos.map((p) => <img key={p.url} role="listitem" src={p.url} alt="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />)}
        </div>
      )}
      <div className="stack" style={{ gap: 4 }}>
        <span className="small">
          {info.price != null && info.price > 0 && <span style={{ color: 'var(--gold-light)' }}>{'$'.repeat(info.price)} · </span>}
          {dayLine ? <span>{on ? `${dayLine.replace(/^\w+:\s*/, `${day}: `)}` : dayLine}</span> : info.hours ? <span className="muted">Closed {day}</span> : <span className="muted">Hours not listed</span>}
          {!on && info.openNow != null && <span style={{ color: info.openNow ? 'var(--rise)' : 'var(--alert)' }}> · {info.openNow ? 'Open now' : 'Closed now'}</span>}
        </span>
        {info.address && <span className="small muted">{info.address}</span>}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {info.website && <a className="btn ghost sm" href={info.website} target="_blank" rel="noopener noreferrer">Menu &amp; website ↗</a>}
        {info.mapsUrl && <a className="btn ghost sm" href={info.mapsUrl} target="_blank" rel="noopener noreferrer">{info.reservable ? 'Reserve on Google ↗' : 'Google Maps ↗'}</a>}
        <a className="btn ghost sm" href={`https://resy.com/cities/new-york-ny/search?query=${q}`} target="_blank" rel="noopener noreferrer">Resy ↗</a>
        <a className="btn ghost sm" href={`https://www.opentable.com/s?term=${q}&metroId=8`} target="_blank" rel="noopener noreferrer">OpenTable ↗</a>
      </div>
      <span className="place-credit" style={{ position: 'static' }}>
        Powered by Google{credits.length > 0 && <> · Photos: {credits.map((c, i) => <span key={c.name}>{i ? ', ' : ''}{c.uri ? <a href={c.uri} target="_blank" rel="noopener noreferrer">{c.name}</a> : c.name}</span>)}</>}
      </span>
    </div>
  );
}
