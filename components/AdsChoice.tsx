'use client';
import { useEffect, useState } from 'react';
import { ADS_OPTOUT_COOKIE } from '@/lib/adsShared';
import { setAdsOptOut } from './AdPixels';

/** "Do not sell or share" switch for ad measurement on Your Privacy Choices. */
export default function AdsChoice() {
  const [off, setOff] = useState<boolean | null>(null);
  const [gpc, setGpc] = useState(false);
  useEffect(() => {
    setGpc(Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl));
    setOff(document.cookie.split('; ').includes(`${ADS_OPTOUT_COOKIE}=off`));
  }, []);
  if (off === null) return null;
  const optedOut = off || gpc;
  return (
    <div className="card stack" style={{ gap: 10, margin: '8px 0 24px' }}>
      <strong>{optedOut ? 'You’re opted out of ad measurement on this browser.' : 'Ad measurement is on for this browser.'}</strong>
      {gpc
        ? <span className="small muted">Your browser sends a Global Privacy Control signal, so ad pixels never load for you.</span>
        : <button type="button" className={optedOut ? 'btn ghost sm' : 'btn sm'} style={{ alignSelf: 'flex-start' }}
            onClick={() => { setAdsOptOut(!optedOut); location.reload(); }}>
            {optedOut ? 'Turn ad measurement back on' : 'Opt out of sale and sharing'}
          </button>}
    </div>
  );
}
