import type { Metadata } from 'next';
import Link from 'next/link';
import DocLayout from '@/components/DocLayout';

export const metadata: Metadata = { title: 'Press · Score', description: 'Press information, fast facts and media contact for Score, the invite-only dating app built on verified credit bands.' };

const FACTS: [string, string][] = [
  ['What it is', 'An invite-only dating app where every member verifies their identity, their photos and their credit band.'],
  ['Where', 'New York City first, opening neighborhood by neighborhood, with more areas to follow.'],
  ['Who it’s for', 'Adults 25 and older who want to date someone with their act together.'],
  ['How bands work', 'A soft credit check (no effect on your score) places members in one of four bands: Elite, Strong, Solid or Building. Members see the band and a 12-month trend, never the number.'],
  ['Every band is welcome', 'Score isn’t about having a perfect score. It’s about honesty around money, which is one of the biggest sources of friction in relationships.'],
  ['Company', 'Score is built by Please & Thank You, Inc., based in New York.'],
];

export default function Press() {
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
            <div key={h} className="tool-card"><h3>{h}</h3><p>{b}</p></div>
          ))}
        </div>
      </section>
      <section>
        <h2>Why credit, and why bands</h2>
        <p>Money is one of the most common sources of conflict between couples, and Federal Reserve research has found that couples with similar credit scores are more likely to stay together. Score makes that conversation easier from the start, without exposing anyone’s numbers: members see a band and a trend, verified through a soft inquiry that never affects their score.</p>
        <p>Every member also verifies a government ID and a live selfie, and each profile photo is matched to that selfie. Read more in our <Link href="/safety">Safety Center</Link>.</p>
      </section>
      <section>
        <h2>Brand assets</h2>
        <p>Logos, product screenshots and founder photos are available on request. Please don’t alter the Score logo or describe Score as a credit product: we aren’t a credit bureau, lender or credit repair service.</p>
      </section>
    </DocLayout>
  );
}
