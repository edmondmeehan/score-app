import Link from 'next/link';
import { getFooter } from '@/lib/footer';
import { BUILD_LABEL } from '@/lib/build';
import NativeVersion from './NativeVersion';

export { BUILD_LABEL };

/** Legal links + build number shown at the bottom of in-app pages. */
/** Build number and copyright show only where `meta` is set (the invite-code start screen). */
export default async function AppFooter({ meta = false }: { meta?: boolean } = {}) {
  const f = await getFooter();
  return (
    <footer className="app-footer">
      <nav aria-label="About ScoreDate">
        {f.app_links.map((l) => (l.href.startsWith('/') ? <Link key={l.label + l.href} href={l.href}>{l.label}</Link> : <a key={l.label + l.href} href={l.href}>{l.label}</a>))}
      </nav>
      {meta && <>
        <span className="small" style={{ color: 'var(--faint)', fontSize: 12 }}>© {new Date().getFullYear()} {f.company}. All rights reserved.</span>
        <NativeVersion />
        <span className="mono small" style={{ color: 'var(--faint)', fontSize: 11, letterSpacing: '.06em' }}>{BUILD_LABEL}</span>
      </>}
    </footer>
  );
}
