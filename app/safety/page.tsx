import type { Metadata } from 'next';
import Link from 'next/link';
import DocLayout from '@/components/DocLayout';
import { getCreditMode, type CreditMode } from '@/lib/creditMode';

export const metadata: Metadata = {
  title: 'Safety Center · ScoreDate',
  description: 'How ScoreDate verifies every member, the safety tools built into the app, dating safety tips, and where to get help.',
};

const I = {
  invite: 'M4 7h16v10H4zM4 7l8 6 8-6',
  id: 'M3 6h18v12H3zM8 10a2 2 0 1 0 0 .01M6 15c.6-1.4 3.4-1.4 4 0M13 10h5M13 13h4',
  photo: 'M4 7h3l2-2h6l2 2h3v12H4zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  band: 'M4 16a8 8 0 0 1 16 0M12 16l4-5',
  money: 'M12 3v18M16 7.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5S9.8 10 12 10s4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5M4 4l16 16',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  share: 'M16 6a2 2 0 1 0 0 .01M6 12a2 2 0 1 0 0 .01M16 18a2 2 0 1 0 0 .01M8 11l6-4M8 13l6 4',
  check: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
  team: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 11a2.5 2.5 0 1 0 0-5M21 19c0-2.2-1.6-3.8-4-4.3',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  chat: 'M4 5h16v11H8l-4 4z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
};
const Icon = ({ d }: { d: string }) => (
  <span className="tool-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg></span>
);

const BAND_TOOL: Record<CreditMode, [keyof typeof I, string, string]> = {
  verified: ['band', 'Verified credit band', 'A soft credit check (it never affects your score) confirms each member’s band. Members see the band, never the number, and bands are re-checked every six months.'],
  self: ['band', 'Self-reported credit band', 'Members choose their band from a free credit score and it’s labeled self-reported until band verification opens. Members see the band, never the number. A false band breaks our Community Guidelines.'],
};
const BASE_TOOLS: [keyof typeof I, string, string][] = [
  ['invite', 'Invite-only', 'Every member is invited by another member or let in from the waitlist by our team. No open sign-ups, no bulk accounts.'],
  ['id', 'ID + live selfie check', 'Members verify a government ID and a live selfie with our identity verification partner before they can match or message. ID images stay with the partner, not on ScoreDate.'],
  ['photo', 'Photo matching', 'Every profile photo is compared with a live selfie, so the face you see is the person you meet. Photos that don’t match go to human review.'],

  ['money', 'Zero tolerance for money requests', 'Asking any member for money, gifts, crypto or investments means immediate removal. It’s the most common romance-scam tactic, so we don’t give it a second chance.'],
  ['flag', 'Report and block anywhere', 'Report or block from any profile or chat. They can’t see or message you afterward, and they never learn it was you.'],
  ['share', 'Share your date with a friend', 'On any confirmed date, send a friend a private link with the where and when. It shows nothing else and expires after the date.'],
  ['check', 'After-date check-in', 'After a date, ScoreDate asks how it went. One tap to say all good, or to tell us something was wrong so we can follow up.'],
  ['team', 'Real people reviewing reports', 'Our trust and safety team reviews every report, usually within 24 hours. Anything involving money or harassment goes to the front of the line.'],
  ['chat', 'Messaging stays in ScoreDate', 'You never have to share your number or social accounts to talk. Keep it in the app until you’re ready.'],
  ['lock', 'Event addresses on a need-to-know basis', 'Exact venue addresses for member events are only shown to people who are going.'],
  ['map', 'Neighborhoods, never people', 'The member map shows neighborhood heat only, for groups of 25 or more, and you can leave yourself off it entirely.'],
];

const TOC = [
  { id: 'tools', h: 'How ScoreDate keeps you safe' },
  { id: 'dating', h: 'Dating safety tips' },
  { id: 'scams', h: 'Spotting romance scams' },
  { id: 'report', h: 'Report a concern' },
  { id: 'help', h: 'Get help now' },
];

export default async function Safety() {
  const mode = await getCreditMode();
  const TOOLS = [...BASE_TOOLS.slice(0, 3), BAND_TOOL[mode], ...BASE_TOOLS.slice(3)];
  return (
    <DocLayout eyebrow="Trust & safety" title="Safety Center" toc={TOC}
      summary="Verified isn’t a slogan at ScoreDate. Every member’s identity, photos and credit band are checked before they can say hello. Here’s everything we do to keep you safe, and what you can do too.">
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 32, borderColor: 'var(--alert)' }}>
        <span><strong>In immediate danger?</strong> <span className="muted">Call 911.</span></span>
        <a href="tel:911" className="btn sm">Call 911</a>
      </div>

      <section id="tools">
        <h2>How ScoreDate keeps you safe</h2>
        <p>Safety is built into every step, from who gets in to what happens after a date.</p>
        <div className="tool-grid" style={{ marginTop: 18 }}>
          {TOOLS.map(([icon, title, body]) => (
            <div key={title} className="tool-card">
              <Icon d={I[icon]} />
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="dating">
        <h2>Dating safety tips</h2>
        <h3>Before you meet</h3>
        <ul>
          <li>Take your time. Chat in ScoreDate until you feel comfortable, and suggest a video call if you want to be sure.</li>
          <li>Look them up a little: does their profile, job and story hang together?</li>
          <li>Keep personal details (home address, workplace, last name, financial information) to yourself until you trust someone.</li>
        </ul>
        <h3>On the date</h3>
        <ul>
          <li>Meet somewhere public and busy for the first few dates. Coffee or one drink is perfect.</li>
          <li>Get there and home on your own. Don’t accept a ride to or from the first date.</li>
          <li>Use <strong>Share with a friend</strong> on your date plan so someone knows where you are.</li>
          <li>Watch your drink and your belongings. If you leave your drink, order a new one.</li>
          <li>Trust your instincts. You can leave at any time, for any reason. “I need to head out” is a complete sentence.</li>
        </ul>
        <h3>After</h3>
        <ul>
          <li>Answer the check-in. It takes one tap, and it helps us keep the community safe.</li>
          <li>If something felt wrong, report it, even if you’re not sure. You might protect the next person.</li>
        </ul>
      </section>

      <section id="scams">
        <h2>Spotting romance scams</h2>
        <p>Verification makes scams rare on ScoreDate, but no system is perfect. Be cautious if someone:</p>
        <ul>
          <li>asks for money, gift cards, crypto, or help with a bill, a visa, a medical emergency or travel, for any reason;</li>
          <li>pitches an investment, trading platform or “opportunity,” even a small one;</li>
          <li>pushes to move the conversation off ScoreDate very quickly;</li>
          <li>professes strong feelings fast but always has a reason not to meet or video chat;</li>
          <li>asks for your account logins, codes or personal financial details.</li>
        </ul>
        <p><strong>A credit band, verified or not, is never a reason to trust a request for money.</strong> Report it in the app. If you’ve sent money, also contact your bank and file reports with the FTC at <a href="https://reportfraud.ftc.gov" target="_blank" rel="noopener noreferrer">ReportFraud.ftc.gov</a> and the FBI at <a href="https://www.ic3.gov" target="_blank" rel="noopener noreferrer">ic3.gov</a>.</p>
      </section>

      <section id="report">
        <h2>Report a concern</h2>
        <p><strong>In the app:</strong> open their profile or your chat, tap <strong>Report</strong>, choose a reason and add any details. You can block them at the same time.</p>
        <p><strong>By email:</strong> write to <a href="mailto:support@scoredate.app?subject=Safety%20concern">support@scoredate.app</a> with the member’s first name, when it happened and what happened. Members can also use <Link href="/app/support">Help &amp; support</Link> in Settings.</p>
        <h3>What happens next</h3>
        <ul>
          <li>We confirm we received your report by email.</li>
          <li>A person on our team reviews it, usually within 24 hours, with money and harassment reports first.</li>
          <li>We may warn, suspend or remove the member, and we cooperate with law enforcement.</li>
          <li>The person you reported never learns it was you, and they can no longer see or message you.</li>
        </ul>
      </section>

      <section id="help">
        <h2>Get help now</h2>
        <p>These services are free, confidential and available 24/7.</p>
        <div className="card" style={{ padding: '4px 18px' }}>
          {([
            ['Emergency', 'Police, fire, medical', 'Call 911', 'tel:911'],
            ['National Domestic Violence Hotline', 'Call 1-800-799-7233 or text START to 88788', 'Call', 'tel:18007997233'],
            ['RAINN National Sexual Assault Hotline', 'Call 1-800-656-4673 or chat online', 'Call', 'tel:18006564673'],
            ['988 Suicide & Crisis Lifeline', 'Call or text 988', 'Call 988', 'tel:988'],
            ['Crisis Text Line', 'Text HOME to 741741', 'Text', 'sms:741741?&body=HOME'],
            ['Report fraud to the FTC', 'ReportFraud.ftc.gov', 'Open', 'https://reportfraud.ftc.gov'],
          ] as const).map(([name, detail, cta, href]) => (
            <div key={name} className="hotline">
              <span className="stack" style={{ gap: 2 }}><strong>{name}</strong><span className="small muted">{detail}</span></span>
              <a href={href} className="btn ghost sm" target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{cta}</a>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 18 }}>Read our <Link href="/legal/community">Community Guidelines</Link> and <Link href="/legal/biometric">Biometric Data Policy</Link>.</p>
      </section>
    </DocLayout>
  );
}
