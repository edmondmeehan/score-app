'use client';
import { useEffect, useState } from 'react';
import EventMap from './EventMap';
import { loadPlaces } from './PlaceFields';
import type { Tiles } from './HeatMap';

/**
 * EventMap that works even when an event was saved without coordinates: it looks the venue up with Google
 * (venue + address) in the browser, then draws the same dark CARTO map. Non-RSVP'd members still only see
 * the neighborhood (rounded to about 1 km).
 */
export default function EventMapAuto({ lat, lng, query, exact, label, tiles }: { lat: number | null; lng: number | null; query: string; exact: boolean; label: string; tiles: Tiles }) {
  const [pos, setPos] = useState<[number, number] | null>(lat != null && lng != null ? [lat, lng] : null);
  useEffect(() => {
    if (pos || !query.trim()) return;
    let live = true;
    (async () => {
      try {
        const places = await loadPlaces();
        const { places: found } = await places.Place.searchByText({ textQuery: query, fields: ['location'], maxResultCount: 1, locationBias: { lat: 40.7359, lng: -73.9911 } });
        const loc = found?.[0]?.location;
        if (live && loc) {
          const round = (n: number) => (exact ? n : Math.round(n * 100) / 100);
          setPos([round(loc.lat()), round(loc.lng())]);
        }
      } catch { /* no key or no result: no map */ }
    })();
    return () => { live = false; };
  }, [pos, query, exact]);
  if (!pos) return null;
  return <EventMap lat={pos[0]} lng={pos[1]} exact={exact} label={label} tiles={tiles} />;
}
