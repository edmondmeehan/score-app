'use client';
import { useEffect, useState } from 'react';
import { lookupZip, type ZipInfo } from '@/app/onboarding/actions';

/** Zip field that shows the neighborhood as soon as five digits are typed. */
export default function ZipInput({ placeholder = '10011' }: { placeholder?: string }) {
  const [zip, setZip] = useState('');
  const [info, setInfo] = useState<ZipInfo>(null);
  useEffect(() => {
    if (!/^[0-9]{5}$/.test(zip)) { setInfo(null); return; }
    let live = true;
    lookupZip(zip).then((r) => live && setInfo(r)).catch(() => null);
    return () => { live = false; };
  }, [zip]);
  return (
    <label className="field">Home zip code
      <input className="input" name="zip" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" placeholder={placeholder}
        value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} />
      {info && <span className="small" style={{ color: info.nyc ? 'var(--gold-light)' : 'var(--muted)' }}>{info.nyc ? [info.neighborhood, info.borough].filter(Boolean).join(', ') : 'Outside NYC for now. Join anyway and we’ll tell you when we open near you.'}</span>}
    </label>
  );
}
