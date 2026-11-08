import Link from 'next/link';
import ThemeSwitch from '@/components/ThemeSwitch';
import { Gauge, Logo } from '@/components/ui';
import { BANDS, type Band } from '@/lib/types';
import WaitlistForm from './WaitlistForm';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import DemandMap from './DemandMap';
import { getCreditMode, CREDIT_COPY } from '@/lib/creditMode';

// Rendered per request so the map always reflects the latest waitlist and the admin sample-data switch.
export const dynamic = 'force-dynamic';

export default async function Landing() {
  const copy = CREDIT_COPY[await getCreditMode()];
  return (
    <div>
      <SiteHeader />

      <section className="page" style={{ padding: '64px 24px 88px', display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center' }}>
        <div className="stack" style={{ flex: '1 1 480px', gap: 26 }}>
          <span className="eyebrow">Invite only · New York</span>
          <h1 className="serif" style={{ fontSize: 'clamp(48px, 8vw, 88px)', lineHeight: 0.98 }}>Date someone who has their act together.</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 520, margin: 0 }}>{copy.heroLine}</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <a href="#invite" className="btn">Request an invite</a>
            <Link href="/join" className="btn ghost">I have an invite code</Link>
          </div>
        </div>
        <div className="hero-glow" style={{ flex: '1 1 320px', display: 'flex', justifyContent: 'center', isolation: 'isolate' }}>
          <Gauge size={280} label="ScoreDate gauge" />
        </div>
      </section>

      <section style={{ borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="page" style={{ padding: '36px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
          {[
            ['Couples with similar credit scores are more likely to stay together.', 'Federal Reserve Board research'],
            copy.strip,
            ['ID and selfie checked. No fake profiles.', 'Images stay with our verification partner'],
          ].map(([a, b]) => (
            <div key={a} className="stack" style={{ gap: 6 }}><span className="serif" style={{ fontSize: 24, lineHeight: 1.2 }}>{a}</span><span className="small muted">{b}</span></div>
          ))}
        </div>
      </section>

      <DemandMap />

      <section id="how" className="page" style={{ padding: '96px 24px 64px' }}>
        <h2 className="serif" style={{ fontSize: 52, marginBottom: 32 }}>Four bands. All welcome.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {(Object.keys(BANDS) as Band[]).map((k) => (
            <div key={k} className="card band-card" style={{ ['--bc' as string]: BANDS[k].color }}>
              <Gauge fill={BANDS[k].fill} color={BANDS[k].color} size={52} dot={false} />
              <div className="serif" style={{ fontSize: 38, color: BANDS[k].color }}>{BANDS[k].label}</div>
              <div className="mono small muted">{BANDS[k].range}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="invite" style={{ background: 'var(--graphite)', borderTop: '1px solid var(--line-soft)' }}>
        <div className="page" style={{ padding: '88px 24px', display: 'flex', flexWrap: 'wrap', gap: 48 }}>
          <div className="stack" style={{ flex: '1 1 360px' }}>
            <h2 className="serif" style={{ fontSize: 52, lineHeight: 1.02 }}>Request an invite</h2>
            <p className="muted" style={{ fontSize: 17, lineHeight: 1.6, margin: 0 }}>New York opens first, in drops every two weeks.</p>
          </div>
          <div style={{ flex: '1 1 440px' }}><WaitlistForm note={copy.formNote} /></div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
