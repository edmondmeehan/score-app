import Link from 'next/link';
import { Logo } from '@/components/ui';

export const metadata = { title: 'ScoreDate member pass', robots: { index: false } };

/** What a regular phone camera opens if someone scans a member pass: no member details, just an explanation. */
export default function PassLanding() {
  return (
    <div className="phone" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <Logo />
      <h1 className="serif" style={{ fontSize: 36, margin: 0 }}>This is a ScoreDate member pass</h1>
      <p className="muted" style={{ margin: 0 }}>Passes are checked by ScoreDate hosts with the host scanner. For privacy, scanning it with a regular camera doesn’t show any member details.</p>
      <Link href="/" className="btn ghost block">About ScoreDate</Link>
    </div>
  );
}
