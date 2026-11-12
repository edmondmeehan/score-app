import type { Metadata } from 'next';
import Link from 'next/link';
import DocLayout from '@/components/DocLayout';
import { getCreditMode } from '@/lib/creditMode';

export const metadata: Metadata = { title: 'Press · ScoreDate', description: 'Press information, fast facts and media contact for ScoreDate, the invite-only dating app for people who follow through.' };

const FACTS: [string, string][] = [
  ['What it is', 'An invite-only dating app where every member verifies their identity and photos and shares their credit band.'],
  ['Where', 'New York City first, opening neighborhood by neighborhood, with more areas to follow.'],
  ['Who it’s for', 'Adults 25 and older in New York who are serious about building a life, and want a partner who follows through.'],
  ['How bands work', 'BANDS_HOW'],
  ['Every band is welcome', 'ScoreDate isn’t about having a perfect score. It’s about honesty around money, which is one of the biggest sources of friction in relationships.'],
  ['Company', 'ScoreDate, LLC is based in New York.'],
];

export default async function Press() {
  const mode = await getCreditMode();
  const how = mode === 'self'
    ? 'Members place themselves in one of four bands (Elite, Strong, Solid or Building) using a free credit score, labeled self-reported until band verification opens. Members see the band and a 12-month trend, never the number.'
    : 'A soft credit check (no effect on your score) places members in one of four bands: Elite, Strong, Solid or Building. Members see the band and a 12-month trend, never the number.';
  return (
    <DocLayout eyebrow="Company" title="Press" wide
      summary="Writing about dating, money or trust? We’re happy to help with facts, data, interviews and visuals.">
      <section>
        <div className="card stack" style={{ gap: 10, marginBottom: 28 }}>
          <strong>Media contact</strong>
          <span className="muted">For interviews, data requests and press assets, email our team. We usually reply within one business day.</span>
          <a href="mailto:press@scoredate.app" className="btn sm" style={{ alignSelf: 'flex-start' }}>press@scoredate.app</a>
        </div>
      </section>
      <section>
        <h2>Fast facts</h2>
        <div className="tool-grid">
          {FACTS.map(([h, b]) => (
            <div key={h} className="tool-card"><h3>{h}</h3><p>{b === 'BANDS_HOW' ? how : b}</p></div>
          ))}
        </div>
      </section>
      <section>
        <h2>Why credit, and why bands</h2>
        <p>Money is one of the most common sources of conflict between couples, and Federal Reserve research has found that couples with similar credit scores are more likely to stay together. ScoreDate makes that conversation easier from the start, without exposing anyone’s numbers: members see a band and a trend, never the number.</p>
        <p>Every member also verifies a government ID and a live selfie, and each profile photo is matched to that selfie. Read more in our <Link href="/safety">Safety Center</Link>.</p>
      </section>
      <section>
        <h2>Brand assets</h2>
        <p>Logos, social templates, colors and our full style guide are on the <Link href="/brand">Brand &amp; marketing</Link> page. Product screenshots and founder photos are available on request. Please don’t alter the ScoreDate logo or describe ScoreDate as a credit product: we aren’t a credit bureau, lender or credit repair service.</p>
      </section>
    </DocLayout>
  );
}
