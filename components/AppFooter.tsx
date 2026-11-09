import { getFooter } from '@/lib/footer';
import { BUILD_LABEL } from '@/lib/build';
import NativeVersion from './NativeVersion';
import NewWindowLink from './NewWindowLink';
import { signOut } from '@/app/signin/actions';

export { BUILD_LABEL };

/** Legal links + build number shown at the bottom of in-app pages. */
/** Build number and copyright show only where `meta` is set (the invite-code start screen). */
export default async function AppFooter({ meta = false, logout = false }: { meta?: boolean; logout?: boolean } = {}) {
  const f = await getFooter();
  return (
    <footer className="app-footer">
      {meta && <div className="stack" style={{ gap: 2, alignItems: 'center' }}>
        <NativeVersion />
        <span className="meta">{BUILD_LABEL}</span>
      </div>}
      <nav aria-label="About ScoreDate">
        {f.app_links.map((l) => (l.href.startsWith('mailto:') ? <a key={l.label + l.href} href={l.href}>{l.label}</a> : <NewWindowLink key={l.label + l.href} href={l.href}>{l.label}</NewWindowLink>))}
        {logout && <form action={signOut} style={{ display: 'contents' }}><button type="submit" className="footer-link">Log out</button></form>}
      </nav>
      {meta && <span className="meta">© {new Date().getFullYear()} ScoreDate, LLC. All Rights Reserved.</span>}
    </footer>
  );
}
