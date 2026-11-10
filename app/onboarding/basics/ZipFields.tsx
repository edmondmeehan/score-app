'use client';
import { useEffect, useState } from 'react';
import { previewZip, type ZipPreview } from '../actions';

/**
 * Home zip code. The neighborhood is filled in from the zip and can't be edited; members change their zip instead.
 * A zip outside the areas we've opened makes the member a Nomad until ScoreDate opens there.
 */
export default function ZipFields({ zip: zip0, neighborhood: hood0, current }: { zip: string; neighborhood: string; current?: boolean }) {
  const [zip, setZip] = useState(zip0);
  const [info, setInfo] = useState<ZipPreview>(null);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (!/^[0-9]{5}$/.test(zip)) { setInfo(null); return; }
    let live = true;
    setLooking(true);
    previewZip(zip).then((r) => { if (live) { setInfo(r); setLooking(false); } }).catch(() => live && setLooking(false));
    return () => { live = false; };
  }, [zip]);

  const hood = info ? info.neighborhood : zip === zip0 ? hood0 : '';
  const nomad = info && !info.open;
  const changed = zip !== zip0;
  return (
    <>
      <label className="field">Home zip code
        <input className="input" name="zip" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} />
        <span className="small" style={{ color: nomad ? 'var(--alert)' : 'var(--muted)' }}>
          {looking ? 'Looking up your neighborhood…'
            : nomad ? (current && !changed
              ? 'You’re a Nomad: this zip is outside the areas ScoreDate has opened. We’ll let you know when we open there.'
              : 'That zip is outside the areas ScoreDate has opened (NYC for now). You’ll be a Nomad: you keep your account and chats, but get no new Drops until we open there.')
            : 'Used to match you with people nearby.'}
        </span>
      </label>
      <div className="field">Neighborhood
        <div className="input" aria-readonly style={{ color: hood ? 'var(--ivory)' : 'var(--muted)', cursor: 'default' }}>{hood || (nomad ? 'Nomad' : 'Filled in from your zip')}</div>
        <span className="small muted">Set from your zip code. To change it, update your zip.</span>
      </div>
    </>
  );
}
