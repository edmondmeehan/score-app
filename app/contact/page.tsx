import type { Metadata } from 'next';
import Link from 'next/link';
import DocLayout from '@/components/DocLayout';

export const metadata: Metadata = { title: 'Contact · ScoreDate', description: 'How to reach ScoreDate: member support, safety, privacy, press and partnerships.' };

const WAYS: [string, string, string, string][] = [
  ['Member support', 'Account, billing, verification or something not working. Members can also use Help & support in Settings.', 'support@scoredate.app', 'mailto:support@scoredate.app'],
  ['Safety concern', 'Report a member from their profile or chat for the fastest response, or email us with details.', 'Report a concern', '/safety#report'],
  ['Privacy requests', 'Access, correct, delete or get a copy of your data.', 'privacy@scoredate.app', 'mailto:privacy@scoredate.app'],
  ['Press', 'Interviews, data and assets.', 'press@scoredate.app', 'mailto:press@scoredate.app'],
  ['Partnerships', 'Venues, member perks, financial wellness and brands.', 'Partner with ScoreDate', '/partners'],
  ['Legal notices', 'Formal legal correspondence.', 'legal@scoredate.app', 'mailto:legal@scoredate.app'],
];

export default function Contact() {
  return (
    <DocLayout eyebrow="Company" title="Contact" wide
      summary="Real people read every message. Here’s the fastest way to reach the right one.">
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 28, borderColor: 'var(--alert)' }}>
        <span><strong>In immediate danger?</strong> <span className="muted">Call 911. For other urgent help, see the <Link href="/safety#help">Safety Center</Link>.</span></span>
      </div>
      <div className="tool-grid">
        {WAYS.map(([h, b, cta, href]) => (
          <div key={h} className="tool-card">
            <h3>{h}</h3>
            <p>{b}</p>
            {href.startsWith('/') ? <Link href={href} className="btn ghost sm" style={{ alignSelf: 'flex-start', marginTop: 6 }}>{cta}</Link>
              : <a href={href} className="btn ghost sm" style={{ alignSelf: 'flex-start', marginTop: 6 }}>{cta}</a>}
          </div>
        ))}
      </div>
      <section style={{ marginTop: 36 }}>
        <h2>Mailing address</h2>
        <p>ScoreDate, LLC<br />1133 Broadway, Suite 1301<br />New York, NY 10010</p>
        <p>We usually reply within one business day.</p>
      </section>
    </DocLayout>
  );
}
