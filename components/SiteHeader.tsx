import Link from 'next/link';
import { Logo } from '@/components/ui';

/** Public-site header. On phones it keeps just the logo, Sign in and the invite button. */
export default function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="site-header">
      <div className="page row" style={{ justifyContent: 'space-between', padding: '18px 20px', gap: 12 }}>
        <Link href="/" aria-label="ScoreDate home" style={{ color: 'inherit', textDecoration: 'none' }}><Logo size={15} /></Link>
        <nav className="row" style={{ gap: 18 }} aria-label="Main">
          <Link href="/#how" className="hide-sm" style={{ color: 'var(--muted)', textDecoration: 'none' }}>How it works</Link>
          <Link href="/safety" className="hide-sm" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Safety</Link>
          <Link href="/signin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Sign in</Link>
          {cta && <Link href="/#invite" className="btn sm">Request an invite</Link>}
        </nav>
      </div>
    </header>
  );
}
