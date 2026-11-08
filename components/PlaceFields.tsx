'use client';
import { useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { google?: any; __scoreMaps?: Promise<any> } }

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

/** Loads Google Maps + Places only when someone starts typing in a place field. */
export function loadPlaces(): Promise<any> {
  if (!KEY) return Promise.reject(new Error('no key'));
  if (window.__scoreMaps) return window.__scoreMaps;
  window.__scoreMaps = new Promise((resolve, reject) => {
    const cb = '__scoreMapsReady';
    (window as any)[cb] = () => window.google.maps.importLibrary('places').then(resolve, reject);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => { window.__scoreMaps = undefined; reject(new Error('maps failed to load')); };
    document.head.appendChild(s);
  });
  return window.__scoreMaps;
}

type Suggestion = { id: string; main: string; secondary: string; prediction: any };
export type PlaceValue = { name?: string | null; address?: string | null; place_id?: string | null; lat?: number | null; lng?: number | null };

/**
 * A place name + address pair with Google Places autocomplete. Picking a suggestion fills the name,
 * the full address and hidden place_id / lat / lng fields. Without a Maps key it's two plain inputs.
 */
export default function PlaceFields({
  nameField = 'venue', nameLabel = 'Venue', namePlaceholder, addressField = 'address', addressLabel = 'Address', addressPlaceholder,
  defaults = {}, required = true, nameMax = 120, addressMax = 200, compact = false, onPick,
}: {
  nameField?: string; nameLabel?: string; namePlaceholder?: string; addressField?: string; addressLabel?: string; addressPlaceholder?: string;
  defaults?: PlaceValue; required?: boolean; nameMax?: number; addressMax?: number; compact?: boolean;
  /** Called with the Google place ID when someone picks a suggestion (null when they type over it). */
  onPick?: (placeId: string | null) => void;
}) {
  const [name, setName] = useState(defaults.name || '');
  const [address, setAddress] = useState(defaults.address || '');
  const [placeId, setPlaceId] = useState(defaults.place_id || '');
  const [lat, setLat] = useState(defaults.lat != null ? String(defaults.lat) : '');
  const [lng, setLng] = useState(defaults.lng != null ? String(defaults.lng) : '');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const lib = useRef<any>(null);
  const token = useRef<any>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const ensure = async () => {
    if (lib.current) return lib.current;
    lib.current = await loadPlaces();
    return lib.current;
  };

  const search = (q: string) => {
    if (!KEY) return;
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setItems([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        const places = await ensure();
        if (!token.current) token.current = new places.AutocompleteSessionToken();
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q, sessionToken: token.current, includedRegionCodes: ['us'],
          locationBias: { center: { lat: 40.7359, lng: -73.9911 }, radius: 50000 },
        });
        if (mine !== seq.current) return;
        const list: Suggestion[] = (suggestions || []).filter((s: any) => s.placePrediction).slice(0, 6).map((s: any) => ({
          id: s.placePrediction.placeId,
          main: s.placePrediction.mainText?.text || s.placePrediction.text?.text || '',
          secondary: s.placePrediction.secondaryText?.text || '',
          prediction: s.placePrediction,
        }));
        setItems(list); setOpen(list.length > 0); setActive(-1);
      } catch { setItems([]); setOpen(false); }
    }, 220);
  };

  const pick = async (s: Suggestion) => {
    setOpen(false); setItems([]);
    setName(s.main.slice(0, nameMax));
    setAddress(s.secondary.slice(0, addressMax));
    setPlaceId(s.id);
    onPick?.(s.id);
    try {
      const place = s.prediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
      if (place.displayName) setName(String(place.displayName).slice(0, nameMax));
      if (place.formattedAddress) setAddress(String(place.formattedAddress).replace(/, USA$/, '').slice(0, addressMax));
      if (place.location) { setLat(String(place.location.lat())); setLng(String(place.location.lng())); }
    } catch { /* keep the suggestion text */ }
    token.current = null; // a pick ends the billing session
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className={compact ? 'stack' : 'row'} style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div ref={boxRef} className="field grow" style={{ position: 'relative', flex: compact ? 'none' : '1 1 220px' }}>
        <label className="field" style={{ margin: 0 }}>
          {nameLabel}
          <input className="input" name={nameField} value={name} required={required} maxLength={nameMax} placeholder={namePlaceholder}
            autoComplete="off" role="combobox" aria-expanded={open} aria-autocomplete="list"
            onFocus={() => { if (KEY) ensure().catch(() => null); }}
            onChange={(e) => { setName(e.target.value); setPlaceId(''); setLat(''); setLng(''); onPick?.(null); search(e.target.value); }}
            onKeyDown={onKey} />
        </label>
        {open && (
          <div role="listbox" className="place-menu">
            {items.map((s, i) => (
              <button key={s.id} type="button" role="option" aria-selected={i === active} className={i === active ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
                <span>{s.main}</span><span className="small muted">{s.secondary}</span>
              </button>
            ))}
            <span className="place-credit">Powered by Google</span>
          </div>
        )}
      </div>
      <label className="field grow" style={{ flex: compact ? 'none' : '1 1 220px' }}>{addressLabel}
        <input className="input" name={addressField} value={address} maxLength={addressMax} placeholder={addressPlaceholder}
          onChange={(e) => { setAddress(e.target.value); setPlaceId(''); setLat(''); setLng(''); }} />
      </label>
      <input type="hidden" name="place_id" value={placeId} />
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
    </div>
  );
}

/** Lazy Google map for a saved place. Falls back to a "Open in Maps" link without a key. */
export function PlaceMap({ placeId, lat, lng, label, address, height = 220 }: { placeId?: string | null; lat?: number | null; lng?: number | null; label: string; address?: string | null; height?: number }) {
  const q = placeId ? `place_id:${placeId}` : lat != null && lng != null ? `${lat},${lng}` : [label, address].filter(Boolean).join(', ');
  const link = placeId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}&query_place_id=${placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {KEY && (
        <iframe title={`Map of ${label}`} src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(KEY)}&q=${encodeURIComponent(q)}&zoom=15`}
          loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen
          style={{ width: '100%', height, border: 0, borderRadius: 14, filter: 'var(--map-filter, none)' }} />
      )}
      <a className="small" href={link} target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>
    </div>
  );
}
