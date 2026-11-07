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
  choices: {
    title: 'Your Privacy Choices',
    body: [
      'DRAFT — to be reviewed by counsel before launch.',
      'Score does not sell your personal information and does not share it for cross-context behavioral advertising.',
      'You can ask us to show you the data we hold about you, correct it, or delete it. Members can delete their account any time in Settings → Delete account. Everything else: email privacy@scoredate.app from the address on your account and we will respond within 30 days.',
      'Email preferences, push notifications and the member map opt-out are all in Settings.',
    ],
  },
  cookies: {
    title: 'Cookie Notice',
    body: [
      'DRAFT — to be reviewed by counsel before launch.',
      'We use a small number of first-party cookies: one to keep you signed in, one to remember your light or dark theme, and two to count visits (a random visitor ID and a 30-minute session ID). We do not use third-party advertising cookies or cross-site trackers.',
      'Blocking cookies will sign you out and reset your theme, but the public site still works.',
    ],
  },
  community: {
    title: 'Community Guidelines',
    body: [
      'Score works because members are who they say they are. These are the rules everyone agrees to.',
      'Be real. Use your own name, current photos of you, and an honest profile. Your band is verified, so the rest should be too.',
      'Be respectful. No harassment, hate, threats, or pressure. If someone isn’t interested, let it go.',
      'Never ask for money. Requests for money, gifts, crypto, investments or financial details are an instant removal. Report it right away.',
      'Keep it private. Don’t share another member’s band, messages or photos outside Score.',
      'No selling. Score isn’t for promoting businesses, services, or other platforms.',
      'Members must be 25 or older. Breaking these rules can lead to a warning, suspension or removal. Report anything that feels off from the member’s profile.',
    ],
  },
  safety: {
    title: 'Dating Safety Tips',
    body: [
      'If you are ever in immediate danger, call 911.',
      'Meet in public for the first few dates, and get there and home on your own.',
      'Tell a friend where you’re going. Score lets you share a date’s time and place with a friend from the chat.',
      'Keep conversations on Score until you trust someone. It keeps reporting and blocking available if you need them.',
      'Never send money or share financial account details, no matter the story. A verified band is not a reason to trust a request for money.',
      'Trust your instincts. You can leave, block or report at any time, and the person won’t know it was you.',
      'After a date, Score asks how it went. If anything was wrong, tell us and our team will follow up.',
    ],
  },
};

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <div className="phone" style={{ maxWidth: 720 }}>
      <h1 className="serif" style={{ fontSize: 40 }}>{d.title}</h1>
      {d.body.map((p, i) => <p key={i} style={{ lineHeight: 1.65, color: i === 0 && p.startsWith('DRAFT') ? 'var(--gold-light)' : 'var(--muted)', margin: 0 }}>{p}</p>)}
      <a href="/" className="small muted">← Back to Score</a>
    </div>
  );
}
