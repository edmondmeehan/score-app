import Link from 'next/link';

const COPY = {
  signup: {
    title: 'Verified by trusted partners. Private by design.',
    points: [
      'A dedicated ID partner checks your ID and selfie. ScoreDate never sees or stores your ID images.',
      'Your credit score stays private. Members only ever see your band, never the number.',
      'Your live selfie for the photo check is compared and then discarded. It’s never saved.',
    ],
  },
  id: {
    title: 'Your ID never touches ScoreDate',
    points: [
      'Your ID and selfie go straight to our ID verification partner, a company that specializes in identity checks.',
      'ScoreDate never sees or stores your ID images. We only get the result: approved, declined or needs review.',
      'Face data is used only to confirm it’s you and is deleted within 30 days, or sooner if you ask.',
    ],
  },
  photos: {
    title: 'Your selfie is checked, then discarded',
    points: [
      'Amazon Web Services compares your live selfie with each photo to confirm it’s really you.',
      'The selfie is never saved. It’s held in memory for the check and thrown away.',
      'We keep only a match score. Photos that don’t clearly match go to a person, never straight to your profile.',
    ],
  },
} as const;

/** Reassurance card for the signup steps: who verifies you, what we keep, and a link to the Biometric Data Policy. */
export default function PrivacyPromise({ kind }: { kind: keyof typeof COPY }) {
  const c = COPY[kind];
  return (
    <section className="privacy-promise" aria-label="How we protect your data">
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        <span className="pp-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
        </span>
        <strong style={{ fontSize: 15, lineHeight: 1.3 }}>{c.title}</strong>
      </div>
      <ul>{c.points.map((p) => <li key={p}>{p}</li>)}</ul>
      <Link href="/legal/biometric" className="pp-link" target="_blank">How we handle biometric data ›</Link>
    </section>
  );
}
