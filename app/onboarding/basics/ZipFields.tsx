'use client';
import { useEffect, useRef, useState } from 'react';
import { lookupZip, type ZipInfo } from '../actions';

/** ZIP input that fills in the neighborhood automatically. The neighborhood stays editable. */
export default function ZipFields({ zip: zip0, neighborhood: hood0 }: { zip: string; neighborhood: string }) {
  const [zip, setZip] = useState(zip0);
  const [hood, setHood] = useState(hood0);
  const [info, setInfo] = useState<ZipInfo>(null);
  const [looking, setLooking] = useState(false);
  const edited = useRef(Boolean(hood0)); // don't overwrite a neighborhood the member typed
  const lastAuto = useRef<string | null>(null);

  useEffect(() => {
    if (!/^[0-9]{5}$/.test(zip)) { setInfo(null); return; }
    let live = true;
    setLooking(true);
    lookupZip(zip).then((r) => {
      if (!live) return;
      setInfo(r);
      setLooking(false);
      const name = r?.neighborhood || r?.borough || null;
      if (name && (!edited.current || hood === lastAuto.current || !hood)) { setHood(name); lastAuto.current = name; edited.current = false; }
    }).catch(() => live && setLooking(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip]);

  return (
    <>
      <label className="field">Home zip code
        <input className="input" name="zip" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} />
        <span className="small" style={{ color: info && !info.nyc ? 'var(--alert)' : info?.nyc ? 'var(--gold-light)' : 'var(--muted)' }}>
          {looking ? 'Looking up your neighborhood…'
            : info?.nyc ? `${[info.neighborhood, info.borough].filter(Boolean).join(', ')}`
            : info && !info.nyc ? 'That zip is outside New York City. ScoreDate is NYC-only for now.'
            : 'Used to match you with people nearby.'}
        </span>
      </label>
      <label className="field">Neighborhood
        <input className="input" name="neighborhood" value={hood} maxLength={60} placeholder="Filled in from your zip"
          onChange={(e) => { setHood(e.target.value); edited.current = true; }} />
        <span className="small muted">Change it if you call it something else.</span>
      </label>
    </>
  );
}
