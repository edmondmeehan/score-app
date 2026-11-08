import type { Metadata } from 'next';
import Link from 'next/link';
import WaitlistForm from '../WaitlistForm';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

// Ad landing page: dating first, verification explained further down. The homepage (/) stays as it is.
export const metadata: Metadata = {
  title: 'ScoreDate · Invite-only dating in New York',
  description: 'Curated matches, verified members, and a first round that starts with money values instead of photos. Request an invite.',
  robots: { index: false, follow: true },
};

const FEATURES: [string, string][] = [
  ['A small Daily Drop', 'A few curated matches each day, picked for shared values and what you’re looking for. No endless swiping.'],
  ['Hot or Financially Compatible?', 'Answer five quick questions about money and life, see how you line up before photos, then both decide.'],
  ['Everyone is verified', 'Every member verifies a government ID and a live selfie. Members are 25+ and live in New York.'],
];

export default function Meet() {
  return (
    <div>
      <SiteHeader />

      <section className="page" style={{ padding: '56px 24px 72px', display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '1 1 440px', gap: 22 }}>
          <span className="eyebrow">Invite only · New York · 25+</span>
          <h1 className="serif" style={{ fontSize: 'clamp(44px, 7vw, 80px)', lineHeight: 0.98 }}>Date someone who’s good with money.</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 520, margin: 0 }}>ScoreDate is invite-only dating for people who have their act together. Curated matches, real people, and a first round that starts with values instead of photos.</p>
          <span className="small muted">New York opens first, in invite drops. Already have a code? <Link href="/join" style={{ color: 'var(--gold)' }}>Join here</Link>.</span>
        </div>
        <div id="invite" style={{ flex: '1 1 400px' }}>
          <div className="card stack" style={{ gap: 12 }}>
            <strong className="serif" style={{ fontSize: 30 }}>Request an invite</strong>
            <WaitlistForm />
          </div>
        </div>
      </section>

      <section style={{ borderTop: '1px solid var(--line-soft)' }}>
        <div className="page" style={{ padding: '64px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {FEATURES.map(([h, p]) => (
            <div key={h} className="card stack" style={{ gap: 8 }}>
              <span className="serif" style={{ fontSize: 28, lineHeight: 1.1 }}>{h}</span>
              <span className="muted" style={{ lineHeight: 1.55 }}>{p}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--graphite)', borderTop: '1px solid var(--line-soft)' }}>
        <div className="page stack" style={{ padding: '64px 24px', gap: 14, maxWidth: 760 }}>
          <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.05 }}>How verification works</h2>
          <p className="muted" style={{ lineHeight: 1.6, margin: 0 }}>When you’re invited, you verify your ID and a live selfie. You also confirm a band (Elite, Strong, Solid or Building) through a soft check that doesn’t affect your credit. Other members see only your band, never a number, and every band is welcome.</p>
          <p className="small muted" style={{ margin: 0 }}>ScoreDate is a dating app. It is not a credit bureau, lender or credit repair service, and it never sees or stores your exact score or credit report.</p>
          <a href="#invite" className="btn" style={{ alignSelf: 'flex-start' }}>Request an invite</a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
