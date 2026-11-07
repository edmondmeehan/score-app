import { notFound } from 'next/navigation';

const DOCS: Record<string, { title: string; body: string[] }> = {
  biometric: {
    title: 'Biometric Data Policy',
    body: [
      'DRAFT — to be reviewed by counsel before launch.',
      'What we collect: during identity verification, our verification partner scans your government ID and a live selfie and compares the face geometry in each. When you add profile photos, we compare each photo with a live selfie to confirm they show you.',
      'Why: only to confirm you are who you say you are and that your photos show you. We never use face data for advertising, and we never sell, lease or trade it.',
      'Who holds it: ID images and the ID selfie are held by our verification partner, not Score. The profile-check selfie is processed in memory and is not stored. Score stores only results (approved, declined, needs review) and a similarity score for each profile photo.',
      'How long: biometric data held by our partner is deleted within 30 days after verification, or immediately when you delete your account, and in all cases no later than permitted by law.',
      'Consent: we ask for your written consent before any face comparison. You can withdraw consent at any time by deleting your account.',
    ],
  },
  privacy: { title: 'Privacy Policy', body: ['DRAFT — to be written with counsel before launch.', 'Score stores your credit band and 12-month trend, never your exact score or credit report.', 'We use first-party cookies to count visits and see which pages people use: a random visitor ID, the device type and browser, the referring site, and city-level location. We do not store IP addresses or sell this data, and we do not use third-party ad trackers.', 'We send account emails (waitlist, invites, verification, membership) through our email provider, Resend.'] },
  terms: { title: 'Terms of Service', body: ['DRAFT — to be written with counsel before launch.', 'Members must be 25 or older.'] },
};

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <div className="phone" style={{ maxWidth: 720 }}>
      <h1 className="serif" style={{ fontSize: 40 }}>{d.title}</h1>
      {d.body.map((p, i) => <p key={i} style={{ lineHeight: 1.65, color: i === 0 ? 'var(--gold-light)' : 'var(--muted)', margin: 0 }}>{p}</p>)}
    </div>
  );
}
