import type { Metadata } from 'next';
import Link from 'next/link';
import WaitlistForm from '../WaitlistForm';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { getCreditMode, CREDIT_COPY } from '@/lib/creditMode';

// Ad landing page: dating first, verification explained further down. The homepage (/) stays as it is.
export const metadata: Metadata = {
  title: 'ScoreDate · Invite-only dating in New York',
  description: 'Reliable is the new attractive. Invite-only dating in New York for people who follow through: verified members and fewer, better matches. Request an invite.',
  robots: { index: false, follow: true },
};

const FEATURES: [string, string][] = [
  ['Feel safe from the first message', 'Every member verifies a government ID and a live selfie. Members are 25+ and live in New York.'],
  ['Be seen for more than your photos', 'Answer five quick questions about money and life, see how you line up before photos, then both decide.'],
  ['Fewer, better matches', 'A small Daily Drop picked for shared values and what you’re looking for. Less swiping, more real dates.'],
];

export default async function Meet() {
  const copy = CREDIT_COPY[await getCreditMode()];
  return (
    <div>
      <SiteHeader />

      <section className="page" style={{ padding: '56px 24px 72px', display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '1 1 440px', gap: 22 }}>
          <span className="eyebrow">Invite only · New York · 25+</span>
          <h1 className="serif" style={{ fontSize: 'clamp(44px, 7vw, 80px)', lineHeight: 0.98 }}>Reliable is the new attractive.</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 520, margin: 0 }}>Meet people who show up, call back and plan ahead. ScoreDate is invite-only dating for grown-ups in New York who are serious about building a life.</p>
          <span className="small muted">New York opens first, in invite drops. Already have a code? <Link href="/join" style={{ color: 'var(--gold)' }}>Join here</Link>.</span>
        </div>
        <div id="invite" style={{ flex: '1 1 400px' }}>
          <div className="card stack" style={{ gap: 12 }}>
            <strong className="serif" style={{ fontSize: 30 }}>Request an invite</strong>
            <WaitlistForm note={copy.formNote} />
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
          <p className="muted" style={{ lineHeight: 1.6, margin: 0 }}>When you’re invited, you verify your ID and a live selfie. {copy.meetLine} Every band is welcome.</p>
          <p className="small muted" style={{ margin: 0 }}>ScoreDate is a dating app. It is not a credit bureau, lender or credit repair service, and it never sees or stores your exact score or credit report.</p>
          <a href="#invite" className="btn" style={{ alignSelf: 'flex-start' }}>Request an invite</a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
