import Link from 'next/link';
import { Steps, TestBanner } from '@/components/ui';
import { personaConfigured } from '@/lib/persona';
import { startIdentity } from '../actions';

export default async function Identity({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const live = await personaConfigured();
  return (
    <form action={startIdentity} className="phone">
      <Steps at={2} />
      <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.05 }}>Prove you&apos;re you</h1>
      <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>Scan your driver&apos;s license or passport, then take a short live selfie. Our verification partner checks the ID is real and that your face matches it. This is why there are no fake profiles on ScoreDate.</p>
      {!live && <TestBanner>The ID partner isn&apos;t connected yet, so this step approves you automatically. No images are taken.</TestBanner>}
      <div className="card stack">
        <span className="label">What happens to your images</span>
        <span className="small" style={{ lineHeight: 1.55 }}>Your ID and selfie go straight to our verification partner, not to ScoreDate. ScoreDate only receives the result (approved, declined or needs review). Face data is used only to confirm your identity and is deleted within 30 days of verification, or sooner if you ask.</span>
      </div>
      <label className="row" style={{ alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5 }}>
        <input type="checkbox" name="consent" value="yes" required style={{ width: 22, height: 22, accentColor: 'var(--gold)', flex: 'none', marginTop: 2 }} />
        <span>I agree that ScoreDate and its verification partner may collect and compare my face geometry from my ID and selfie, as described in the <Link href="/legal/biometric">Biometric Data Policy</Link>.</span>
      </label>
      {sp.error && <div className="notice error">{sp.error}</div>}
      <button className="btn block">{live ? 'Start ID check' : 'Continue (test mode)'}</button>
    </form>
  );
}
