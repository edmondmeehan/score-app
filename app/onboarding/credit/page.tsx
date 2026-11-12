import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { Gauge, Steps, TestBanner } from '@/components/ui';
import { BANDS, type Band } from '@/lib/types';
import { testSetBand, creditStart, creditVerify, selfReportBand } from '../actions';
import { getCreditMode } from '@/lib/creditMode';
import CreditPartners from '@/components/CreditPartners';
import { spinwheelConfigured, spinwheelSandbox } from '@/lib/spinwheel';

export default async function Credit({ searchParams }: { searchParams: Promise<{ error?: string; revealed?: string; step?: string; update?: string }> }) {
  const { me } = await getMe();
  if (!me) redirect('/signin');
  const sp = await searchParams;
  const mode = await getCreditMode();
  const verified = Boolean(me.credit_verified_at);
  const updating = sp.update === '1' && Boolean(me.band) && mode === 'self' && !verified;
  if (me.band && sp.revealed && sp.update === '1') redirect('/app/settings?saved=band#band');
  if (me.band && sp.revealed) {
    const b = BANDS[me.band];
    return (
      <div className="phone" style={{ alignItems: 'center', textAlign: 'center' }}>
        <span className="label" style={{ paddingTop: 32 }}>{verified ? 'Verified' : 'Self-reported'}</span>
        <Gauge fill={b.fill} color={b.color} size={220} track="var(--track)" />
        <span className="muted" style={{ marginTop: -50 }}>You&apos;re</span>
        <h1 className="serif" style={{ fontSize: 72, lineHeight: 1, color: b.color }}>{b.label}</h1>
        <span className="mono small muted">{b.range}</span>
        {me.trend === 'up' && <span className="chip" style={{ color: 'var(--rise)', borderColor: 'var(--rise-line)' }}>Trending up over 12 months</span>}
        <div className="card stack" style={{ width: '100%', textAlign: 'left' }}>
          <span className="small">Members see <strong>{b.label}</strong> and your trend.</span>
          <span className="small muted">{verified ? 'Your exact score was never stored.' : 'Shown as self-reported. You can verify it later in Settings when verification opens.'}</span>
        </div>
        <a className="btn block" href="/onboarding">Next: your money values</a>
      </div>
    );
  }
  if (me.band && (mode === 'self' || verified) && !updating) redirect(sp.update === '1' ? '/app/settings#band' : '/onboarding');
  const fromSelf = Boolean(me.band) && !verified; // verified mode, member who self-reported earlier
  if (mode === 'self') {
    return (
      <form action={selfReportBand} className="phone">
        {updating ? <a href="/app/settings#band" className="pill-link" style={{ alignSelf: 'flex-start' }}>← Settings</a> : <Steps at={3} />}
        {updating && <input type="hidden" name="update" value="1" />}
        <h1 className="serif" style={{ fontSize: 38 }}>{updating ? 'Update your credit band' : 'Share your credit band'}</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>Check your score on a free service below, or in your bank or card app. Checking it there doesn&apos;t affect your credit. Then pick the band it falls in. Members see your band, never the number. It’s one signal among many, and every band is welcome.</p>
        <CreditPartners placement="onboarding" />
        <div role="radiogroup" aria-label="Your band" className="stack">
          {(Object.keys(BANDS) as Band[]).map((k) => (
            <label key={k} className="choice"><input type="radio" name="band" value={k} required defaultChecked={updating && me.band === k} style={{ accentColor: 'var(--gold)' }} /><span style={{ color: BANDS[k].color, fontWeight: 600 }}>{BANDS[k].label}</span><span className="muted small">{BANDS[k].range}</span></label>
          ))}
        </div>
        <label className="field">Over the last 12 months, your score has gone<select className="input" name="trend" defaultValue={updating ? me.trend || 'steady' : 'steady'}><option value="up">Up</option><option value="steady">About the same</option><option value="down">Down</option></select></label>
        <label className="choice" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" name="confirm" value="yes" required style={{ accentColor: 'var(--gold)', width: 18, height: 18, marginTop: 2 }} />
          <span className="small">This matches my current credit score. I understand my band shows as <strong>self-reported</strong> and that giving a false band breaks the Community Guidelines.</span>
        </label>
        {sp.error && <div className="notice error">{sp.error}</div>}
        <button className="btn block">Save my band</button>
        <span className="small muted" style={{ textAlign: 'center' }}>ScoreDate doesn&apos;t pull your credit or see your score.</span>
      </form>
    );
  }
  if (spinwheelConfigured()) {
    const sandbox = spinwheelSandbox();
    if (sp.step === 'code') {
      return (
        <form action={creditVerify} className="phone">
          <Steps at={3} />
          <h1 className="serif" style={{ fontSize: 38 }}>Enter your code</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>We texted a 6-digit code from our credit partner, Spinwheel. It expires in 5 minutes.</p>
          {sandbox && <TestBanner>Sandbox demo. Enter the code texted to your phone. No real credit data is used.</TestBanner>}
          <label className="field">Code<input className="input mono" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></label>
          {sp.error && <div className="notice error">{sp.error}</div>}
          <button className="btn block">Verify and see my band</button>
          <a className="small muted" href="/onboarding/credit" style={{ textAlign: 'center' }}>Start over</a>
        </form>
      );
    }
    return (
      <form action={creditStart} className="phone">
        <Steps at={3} />
        <h1 className="serif" style={{ fontSize: 38 }}>Verify your credit</h1>
        {fromSelf && <div className="notice">Your band is self-reported. Verify it now so it shows as verified on your profile.</div>}
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>A soft pull confirms your band. It doesn&apos;t affect your score and lenders never see it. Members see your band and trend, never the number.</p>
        {sandbox && <TestBanner>Sandbox demo with Spinwheel. Use your own mobile number (for the code) and a sandbox test birth date: 1990-03-06 (score 800), 1990-03-05 (score 500) or 1967-06-08 (default).</TestBanner>}
        <label className="field">Mobile number<input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(212) 555-0123" required /></label>
        <label className="field">Date of birth<input className="input" name="dob" type="date" autoComplete="bday" required /></label>
        <label className="choice" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" name="consent" value="yes" required style={{ accentColor: 'var(--gold)', width: 18, height: 18, marginTop: 2 }} />
          <span className="small">I authorize ScoreDate and its partner Spinwheel to get my credit information from a credit bureau with a soft inquiry, which does not affect my credit score, to confirm my credit band. ScoreDate keeps only the band, never my score or report.</span>
        </label>
        {sp.error && <div className="notice error">{sp.error}</div>}
        <button className="btn block">Text me a code</button>
      </form>
    );
  }
  return (
    <form action={testSetBand} className="phone">
      <Steps at={3} />
      <h1 className="serif" style={{ fontSize: 38 }}>Verify your credit</h1>
      <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>A soft pull confirms your band. It doesn&apos;t affect your score and lenders never see it. Members see your band and trend, never the number.</p>
      <TestBanner>The credit partner isn&apos;t connected yet. Pick the band to simulate. In production this screen collects consent and the partner sends your band directly.</TestBanner>
      <div role="radiogroup" aria-label="Band to simulate" className="stack">
        {(Object.keys(BANDS) as Band[]).map((k, i) => (
          <label key={k} className="choice"><input type="radio" name="band" value={k} defaultChecked={i === 1} required style={{ accentColor: 'var(--gold)' }} /><span style={{ color: BANDS[k].color, fontWeight: 600 }}>{BANDS[k].label}</span><span className="muted small">{BANDS[k].range}</span></label>
        ))}
      </div>
      <label className="field">12-month trend<select className="input" name="trend" defaultValue="up"><option value="up">Up</option><option value="steady">Steady</option><option value="down">Down</option></select></label>
      {sp.error && <div className="notice error">{sp.error}</div>}
      <button className="btn block">Verify (test mode)</button>
    </form>
  );
}
