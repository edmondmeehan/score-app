import Link from 'next/link';

export const BUILD_LABEL = `Score ${process.env.NEXT_PUBLIC_APP_VERSION || ''} · Build ${process.env.NEXT_PUBLIC_BUILD_NUMBER || 'dev'}${process.env.NEXT_PUBLIC_DEPLOY_ID ? ` (${process.env.NEXT_PUBLIC_DEPLOY_ID})` : ''}`;

/** Legal links + build number shown at the bottom of in-app pages. */
export default function AppFooter() {
  return (
    <footer className="app-footer">
      <nav aria-label="About Score">
        <Link href="/partners">Partners</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/biometric">Biometric policy</Link>
      </nav>
      <span className="mono small" style={{ color: 'var(--faint)', fontSize: 11, letterSpacing: '.06em' }}>{BUILD_LABEL}</span>
    </footer>
  );
}
