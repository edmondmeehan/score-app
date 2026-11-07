import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { Gauge, Steps, TestBanner } from '@/components/ui';
import { BANDS, type Band } from '@/lib/types';
import { testSetBand } from '../actions';

export default async function Credit({ searchParams }: { searchParams: Promise<{ error?: string; revealed?: string }> }) {
  const { me } = await getMe();
  if (!me) redirect('/signin');
  const sp = await searchParams;
  if (me.band && sp.revealed) {
    const b = BANDS[me.band];
    return (
      <div className="phone" style={{ alignItems: 'center', textAlign: 'center' }}>
        <span className="label" style={{ paddingTop: 32 }}>Verified</span>
        <Gauge fill={b.fill} color={b.color} size={220} track="var(--track)" />
        <span className="muted" style={{ marginTop: -50 }}>You&apos;re</span>
        <h1 className="serif" style={{ fontSize: 72, lineHeight: 1, color: b.color }}>{b.label}</h1>
        <span className="mono small muted">{b.range}</span>
        {me.trend === 'up' && <span className="chip" style={{ color: 'var(--rise)', borderColor: 'var(--rise-line)' }}>Trending up over 12 months</span>}
        <div className="card stack" style={{ width: '100%', textAlign: 'left' }}>
          <span className="small">Members see <strong>{b.label}</strong> and your trend.</span>
          <span className="small muted">Your exact score was never stored.</span>
        </div>
        <a className="btn block" href="/onboarding">Next: your money values</a>
      </div>
    );
  }
  if (me.band) redirect('/onboarding');
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
