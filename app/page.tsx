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
          <span className="eyebrow">Invite only · New York · 25+</span>
          <h1 className="serif" style={{ fontSize: 'clamp(48px, 8vw, 88px)', lineHeight: 0.98 }}>Reliable is the new attractive.</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 520, margin: 0 }}>Meet people who show up, call back and plan ahead. ScoreDate is invite-only dating for grown-ups in New York who are serious about building a life.</p>
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
            ['Every member is verified.', 'Government ID and a live selfie. Everyone is 25+.'],
            ['Fewer, better matches.', 'A small Daily Drop instead of endless swiping.'],
            ['Built to get you to a real date.', 'Plan it in the chat, share it with a friend.'],
          ].map(([a, b]) => (
            <div key={a} className="stack" style={{ gap: 6 }}><span className="serif" style={{ fontSize: 24, lineHeight: 1.2 }}>{a}</span><span className="small muted">{b}</span></div>
          ))}
        </div>
      </section>

      <section className="page" style={{ padding: '96px 24px 32px' }}>
        <h2 className="serif" style={{ fontSize: 52, marginBottom: 12, lineHeight: 1.02 }}>For people who follow through.</h2>
        <p className="muted" style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 640, margin: '0 0 32px' }}>Not a filter for who’s worthy. A place for adults who mean what they say, and want the same in a partner.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            ['Feel safe from the first message', 'Everyone is ID-verified and real. Report or block anyone, and our team reviews every report.'],
            ['Be seen for more than your photos', 'Money values and life plans come first. See how you line up before photos are revealed.'],
            ['Spend your time on people who mean it', 'A few thoughtful matches a day, picked for what you both want. Less swiping, more dates.'],
          ].map(([h, p]) => (
            <div key={h} className="card stack" style={{ gap: 8 }}>
              <span className="serif" style={{ fontSize: 28, lineHeight: 1.1 }}>{h}</span>
              <span className="muted" style={{ lineHeight: 1.55 }}>{p}</span>
            </div>
          ))}
        </div>
      </section>

      <DemandMap />

      <section id="how" className="page" style={{ padding: '96px 24px 64px' }}>
        <h2 className="serif" style={{ fontSize: 52, marginBottom: 12, lineHeight: 1.02 }}>How we know you’re serious.</h2>
        <p className="muted" style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 680, margin: '0 0 32px' }}>Every member verifies their identity, answers a few questions about money and life, and shares a credit band: a range, never a number. It’s one signal among many, and every band is welcome.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {(Object.keys(BANDS) as Band[]).map((k) => (
            <div key={k} className="card band-card" style={{ ['--bc' as string]: BANDS[k].color }}>
              <Gauge fill={BANDS[k].fill} color={BANDS[k].color} size={52} dot={false} />
              <div className="serif" style={{ fontSize: 38, color: BANDS[k].color }}>{BANDS[k].label}</div>
              <div className="mono small muted">{BANDS[k].range}</div>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 28, flexWrap: 'wrap', marginTop: 28 }}>
          <span className="small muted">{copy.strip[0]} {copy.strip[1]}.</span>
          <span className="small muted">Couples with similar credit scores are more likely to stay together. (Federal Reserve Board research)</span>
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
