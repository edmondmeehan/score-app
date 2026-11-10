import { BandPill } from '@/components/ui';
import { BANDS, type Profile } from '@/lib/types';
import { confirmBand } from '@/app/app/actions';

type Me = Profile & { band_reported_at?: string | null };
const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Settings: the member's band, when it was last updated, and how to refresh it. */
export default function BandCard({ me, mode }: { me: Me; mode: 'self' | 'verified' }) {
  if (!me.band) return null;
  const verified = Boolean(me.credit_verified_at);
  const at = verified ? me.credit_verified_at : me.band_reported_at;
  const days = at ? Math.floor((Date.now() - new Date(at).getTime()) / 86400000) : null;
  const canChange = !verified && mode === 'self' && (days === null || days >= 30);
  const nextChange = at ? new Date(new Date(at).getTime() + 30 * 86400000) : null;
  return (
    <div className="card stack" id="band" style={{ gap: 10 }}>
      <span className="label">Your credit band</span>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span className="row" style={{ gap: 10 }}><strong style={{ color: BANDS[me.band].color, fontSize: 18 }}>{BANDS[me.band].label}</strong><BandPill band={me.band} trend={me.trend} verified={verified} /></span>
        {at && <span className="small muted">{verified ? 'Verified' : 'Updated'} {fmt(at)}</span>}
      </div>
      {verified ? (
        <span className="small muted">Verified bands are re-checked every six months with a soft check. We’ll email you when it’s time.</span>
      ) : mode !== 'self' ? (
        <a href="/onboarding/credit" className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>Verify my band</a>
      ) : (
        <>
          <span className="small muted">Self-reported. Scores change month to month, so check yours and keep your band current. You can change it once every 30 days.</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {canChange
              ? <a href="/onboarding/credit?update=1" className="btn ghost sm">Update my band</a>
              : <span className="small muted">You can change it on {nextChange ? nextChange.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'soon'}.</span>}
            <form action={confirmBand}><button className="btn ghost sm">Still the same</button></form>
          </div>
        </>
      )}
    </div>
  );
}
