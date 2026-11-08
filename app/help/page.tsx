import type { Metadata } from 'next';
import Link from 'next/link';
import DocLayout from '@/components/DocLayout';
import { PLANS } from '@/lib/types';

export const metadata: Metadata = { title: 'Help center · ScoreDate', description: 'Answers about credit bands, the soft check, billing, cancelling, safety and your account on ScoreDate.' };

type QA = [string, React.ReactNode];
const SECTIONS: { id: string; h: string; items: QA[] }[] = [
  { id: 'start', h: 'Getting started', items: [
    ['How do I join?', <>ScoreDate is invite-only. <Link href="/#invite">Join the waitlist</Link> or use an invite code from a member. Invites go out in drops as each area opens, starting with New York City.</>],
    ['Who can join?', 'Adults 25 and older who live in an area we’ve opened. Everyone verifies a government ID, a live selfie and a credit band.'],
    ['How do I move up the waitlist?', 'Share your invite link. Each friend who joins moves you up 5 spots, and 3 friends makes you a Founding Member.'],
  ] },
  { id: 'bands', h: 'Credit bands', items: [
    ['Will checking my band hurt my credit score?', 'No. It’s a soft inquiry, which doesn’t affect your credit score and isn’t visible to lenders.'],
    ['What do other members see?', 'Only your band (Elite, Strong, Solid or Building) and whether it’s trending up over 12 months. Never your score or your credit report.'],
    ['Does ScoreDate store my credit score?', 'No. ScoreDate never sees or stores your exact score or report, only the band and trend.'],
    ['Can I get in with a lower band?', 'Yes. Every band is welcome. ScoreDate is about honesty around money, not having a perfect number.'],
    ['How often is my band updated?', 'We ask you to re-verify every 6 months so bands stay current. If yours goes up, re-verify any time.'],
  ] },
  { id: 'billing', h: 'Plans & billing', items: [
    ['What do plans cost?', <>Preview is $9.99 once. {PLANS.membership.name} is {PLANS.membership.monthly}, {PLANS.premium.name} is {PLANS.premium.monthly}. Prices are always shown before you buy.</>],
    ['How do I cancel?', 'On iPhone: Settings → your name → Subscriptions → ScoreDate. On Android: Google Play → Payments & subscriptions → Subscriptions. Cancel at least 24 hours before renewal. You keep access until the period ends.'],
    ['Can I take a break without cancelling?', 'Yes. Choose Paused ($4.99/mo) in Settings to hide your profile while keeping your matches and chats. Taken works the same way when you’ve met someone.'],
    ['How do refunds work?', 'App Store and Google Play purchases are refunded by Apple or Google. On iPhone, request one at reportaproblem.apple.com. On Android, through Google Play.'],
  ] },
  { id: 'matching', h: 'Matching & messaging', items: [
    ['What is the Daily Drop?', 'A small set of curated matches each day, ranked by money values and preferences.'],
    ['What is Hot or Financially Compatible?', 'Answer five money questions, see your compatibility with someone before photos, then both decide whether to connect. The percentage is just for fun.'],
    ['How do likes work?', 'Tap ♡ on a profile. If they like you back, you match and can chat. Premium members can see everyone who liked them.'],
    ['What does Unmatch do?', 'It ends the chat for both of you without reporting anyone. Neither of you can send more messages there.'],
    ['Why is a photo blurred?', 'Photos in chat are blurred until you tap them, so you’re never surprised by something you didn’t want to see.'],
  ] },
  { id: 'safety', h: 'Safety & privacy', items: [
    ['How do I report someone?', 'Open their profile or chat, tap More, then Report. A person on our team reviews every report, and we’ll let you know once we’ve acted.'],
    ['What are the scam warnings in chat?', 'If a message asks for money, gift cards or crypto, or pushes to move off ScoreDate fast, we show you a warning. Never send money to someone you haven’t met.'],
    ['Are screenshots blocked?', 'Screenshots are recorded where your device lets us detect them, to protect members’ privacy. Please don’t share other people’s profiles or messages.'],
    ['How do I get a copy of my data?', 'Settings → Your data → Download my data.'],
    ['How do I delete my account?', 'Settings → Delete account. Cancel any App Store or Google Play subscription first so you aren’t billed again.'],
  ] },
];

export default function Help() {
  return (
    <DocLayout eyebrow="Support" title="Help center" toc={[...SECTIONS.map((s) => ({ id: s.id, h: s.h })), { id: 'contact', h: 'Still need help?' }]}
      summary="Quick answers about bands, billing, matching and safety. Can’t find yours? We’re here.">
      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id}>
          <h2>{s.h}</h2>
          <div className="stack" style={{ gap: 8 }}>
            {s.items.map(([q, a]) => (
              <details key={q} className="card" style={{ padding: '14px 16px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--ivory)' }}>{q}</summary>
                <p style={{ margin: '10px 0 0' }}>{a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <section id="contact">
        <h2>Still need help?</h2>
        <p>Members can message us from <Link href="/app/support">Settings → Contact support</Link>. Everyone else can email <a href="mailto:support@scoredate.app">support@scoredate.app</a>. In an emergency, call 911.</p>
      </section>
    </DocLayout>
  );
}
