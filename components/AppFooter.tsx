import Link from 'next/link';
import { getFooter } from '@/lib/footer';
import { BUILD_LABEL } from '@/lib/build';

export { BUILD_LABEL };

/** Legal links + build number shown at the bottom of in-app pages. */
export default async function AppFooter() {
  const f = await getFooter();
  return (
    <footer className="app-footer">
      <nav aria-label="About ScoreDate">
        {f.app_links.map((l) => (l.href.startsWith('/') ? <Link key={l.label + l.href} href={l.href}>{l.label}</Link> : <a key={l.label + l.href} href={l.href}>{l.label}</a>))}
      </nav>
      <span className="mono small" style={{ color: 'var(--faint)', fontSize: 11, letterSpacing: '.06em' }}>{BUILD_LABEL}</span>
    </footer>
  );
}
