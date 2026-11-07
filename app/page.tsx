import Link from 'next/link';
import ThemeSwitch from '@/components/ThemeSwitch';
import { Gauge, Logo } from '@/components/ui';
import { BANDS, type Band } from '@/lib/types';
import WaitlistForm from './WaitlistForm';
import DemandMap from './DemandMap';

// Rebuilt at most every 10 minutes so the map stays fresh without slowing the page.
export const revalidate = 600;

export default async function Landing() {
  return (
    <div>
      <header className="page row" style={{ justifyContent: 'space-between', padding: '24px', flexWrap: 'wrap' }}>
        <Logo />
        <nav className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
          <a href="#how" style={{ color: 'var(--muted)', textDecoration: 'none' }}>How it works</a>
          <Link href="/signin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Sign in</Link>
          <a href="#invite" className="btn sm">Request an invite</a>
        </nav>
      </header>

      <section className="page" style={{ padding: '64px 24px 88px', display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center' }}>
        <div className="stack" style={{ flex: '1 1 480px', gap: 26 }}>
          <span className="eyebrow">Invite only · New York</span>
          <h1 className="serif" style={{ fontSize: 'clamp(48px, 8vw, 88px)', lineHeight: 0.98 }}>Date someone who has their act together.</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 520, margin: 0 }}>Score is the dating app where every member has verified their credit and their identity. Every band is welcome. Honesty about money is required.</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <a href="#invite" className="btn">Request an invite</a>
            <Link href="/join" className="btn ghost">I have an invite code</Link>
          </div>
        </div>
        <div className="hero-glow" style={{ flex: '1 1 320px', display: 'flex', justifyContent: 'center', isolation: 'isolate' }}>
          <Gauge size={280} label="Score gauge" />
        </div>
      </section>

      <section style={{ borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="page" style={{ padding: '36px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
          {[
            ['Couples with similar credit scores are more likely to stay together.', 'Federal Reserve Board research'],
            ['Soft pull only. Your score is never affected.', 'About 60 seconds'],
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
          <div style={{ flex: '1 1 440px' }}><WaitlistForm /></div>
        </div>
      </section>
      <footer style={{ borderTop: '1px solid var(--line-soft)', background: 'var(--graphite)' }}>
        <div className="page site-footer" style={{ padding: '56px 24px 28px' }}>
          <div className="stack site-footer-brand" style={{ gap: 12 }}>
            <Logo />
            <span className="small muted" style={{ lineHeight: 1.6 }}>The invite-only dating app built on verified credit bands. Now open in New York City.</span>
            <address className="small muted" style={{ fontStyle: 'normal', lineHeight: 1.6 }}>
              Please &amp; Thank You, Inc.<br />1133 Broadway, Suite 1301<br />New York, NY 10010
            </address>
            <a href="mailto:support@scoredate.app" className="small" style={{ color: 'var(--gold)' }}>support@scoredate.app</a>
          </div>
          {([
            ['Score', [['How it works', '#how'], ['Where we’re live', '#where'], ['Request an invite', '#invite'], ['I have a code', '/join'], ['Sign in', '/signin']]],
            ['Trust & safety', [['Safety tips', '/legal/safety'], ['Community guidelines', '/legal/community'], ['Biometric data policy', '/legal/biometric'], ['Report a concern', 'mailto:support@scoredate.app?subject=Safety%20concern']]],
            ['Company', [['Partners', '/partners'], ['Press', 'mailto:press@scoredate.app'], ['Contact', 'mailto:support@scoredate.app']]],
            ['Legal', [['Terms of Service', '/legal/terms'], ['Privacy Policy', '/legal/privacy'], ['Your privacy choices', '/legal/choices'], ['Cookie notice', '/legal/cookies']]],
          ] as const).map(([title, links]) => (
            <nav key={title} className="stack" style={{ gap: 10 }} aria-label={title}>
              <span className="label">{title}</span>
              {links.map(([l, href]) => (
                href.startsWith('/') && !href.startsWith('/#')
                  ? <Link key={l} href={href} className="small" style={{ color: 'var(--muted)', textDecoration: 'none' }}>{l}</Link>
                  : <a key={l} href={href} className="small" style={{ color: 'var(--muted)', textDecoration: 'none' }}>{l}</a>
              ))}
            </nav>
          ))}
        </div>
        <div className="page small" style={{ padding: '18px 24px 32px', borderTop: '1px solid var(--line-soft)', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', color: 'var(--faint)' }}>
          <span>© {new Date().getFullYear()} Please &amp; Thank You, Inc. All rights reserved. Members must be 25+.</span>
          <ThemeSwitch />
        </div>
        <p className="page small" style={{ padding: '0 24px 40px', color: 'var(--faint)', lineHeight: 1.6, margin: '0 auto' }}>
          Score is not a credit bureau, lender or credit repair service. Checking your band uses a soft inquiry that does not affect your credit score. Score never sees or stores your exact score or credit report. In an emergency, call 911.
        </p>
      </footer>
    </div>
  );
}
