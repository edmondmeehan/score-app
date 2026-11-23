import type { Metadata } from 'next';
import Link from 'next/link';
import WaitlistForm from '../WaitlistForm';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { getCreditMode, CREDIT_COPY } from '@/lib/creditMode';
import { getFounderDeal } from '@/lib/founderDeal';

// Ad landing page: dating first, verification explained further down. The homepage (/) stays as it is.
// Served from Vercel's cache, refreshed at most once a minute.
export const revalidate = 60;

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
  const [mode, deal] = await Promise.all([getCreditMode(), getFounderDeal()]);
  const copy = CREDIT_COPY[mode];
  return (
    <div>
      <SiteHeader />

      <section className="page" style={{ padding: '56px 24px 72px', display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '1 1 440px', gap: 22 }}>
          <span className="eyebrow">Invite only · New York · 25+</span>
          <h1 className="serif" style={{ fontSize: 'clamp(44px, 7vw, 80px)', lineHeight: 0.98 }}>Reliable is the new attractive.</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 520, margin: 0 }}>Meet people who show up, call back and plan ahead. ScoreDate is invite-only dating for grown-ups in New York who are serious about building a life.</p>
          <span className="small muted">New York opens first, in invite drops. Already have a code? <Link href="/join" style={{ color: 'var(--gold)' }}>Join here</Link>.</span>
          {deal.enabled && (
            <div className="card gold stack founder-offer" style={{ gap: 10, maxWidth: 520 }}>
              <span className="label" style={{ color: 'var(--gold-light)' }}>Founding Members · limited spots</span>
              <span className="serif" style={{ fontSize: 28, lineHeight: 1.1 }}>Up to {deal.months} months of Membership free.</span>
              <span style={{ lineHeight: 1.5 }}>Then a Founding rate of <strong>{deal.price}/month</strong>, locked in for as long as you stay a member. Founding spots only go to people on the waitlist, so join now.</span>
              <a href="#founding" className="small" style={{ color: 'var(--gold)' }}>How to become a Founding Member</a>
            </div>
          )}
        </div>
        <div id="invite" style={{ flex: '1 1 400px' }}>
          <div className="card stack" style={{ gap: 12 }}>
            <strong className="serif" style={{ fontSize: 30 }}>Request an invite</strong>
            {deal.enabled && <span className="small" style={{ color: 'var(--gold-light)', marginTop: -6 }}>Join the waitlist now to be eligible for a founding spot.</span>}
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

      {deal.enabled && (
        <section id="founding" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <div className="page stack" style={{ padding: '64px 24px', gap: 18, maxWidth: 860 }}>
            <span className="eyebrow">Founding Members</span>
            <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: 0 }}>Get in early, pay less for as long as you stay.</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div className="card stack" style={{ gap: 6 }}><strong>Up to {deal.months} months free</strong><span className="small muted">Full Membership at no cost, starting when your account is verified and active.</span></div>
              <div className="card stack" style={{ gap: 6 }}><strong>{deal.price}/month after that</strong><span className="small muted">Your Founding rate, locked in for as long as you stay subscribed without a break.</span></div>
              <div className="card stack" style={{ gap: 6 }}><strong>A Founding badge</strong><span className="small muted">On your profile, plus first in line when invites go out and extra invites for friends.</span></div>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <strong>How to get a founding spot</strong>
              <span className="muted" style={{ lineHeight: 1.6 }}>Join the waitlist. The first members in each neighborhood get a founding spot automatically, and anyone on the list can earn one by bringing 3 friends with their personal link. Spots are limited, and they only go to people on the waitlist.</span>
            </div>
            <a href="#invite" className="btn" style={{ alignSelf: 'flex-start' }}>Join the waitlist</a>
            <span className="small muted">Founding rate is billed monthly through the App Store and renews until you cancel. If your subscription ends or lapses, the Founding rate ends too, and you can rejoin at regular prices. Offer details may change for people who haven’t joined yet. See <Link href="/legal/terms" style={{ color: 'inherit' }}>Terms</Link>.</span>
          </div>
        </section>
      )}

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
