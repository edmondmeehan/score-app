import Link from 'next/link';
import { Logo } from '@/components/ui';
import ThemeSwitch from '@/components/ThemeSwitch';
import { getFooter, type FooterConfig } from '@/lib/footer';

/** Public-site footer, shared by the home page and every info/legal page. */
export default async function SiteFooter() {
  return <SiteFooterView f={await getFooter()} />;
}

/** Also used by Admin → Footer for the live preview. */
export function SiteFooterView({ f }: { f: FooterConfig }) {
  return (
        <footer style={{ borderTop: '1px solid var(--line-soft)', background: 'var(--graphite)' }}>
          <div className="page site-footer" style={{ padding: '56px 24px 28px', ['--cols' as string]: Math.max(1, f.columns.length) }}>
            <div className="stack site-footer-brand" style={{ gap: 12 }}>
              <Logo />
              {f.tagline && <span className="small muted" style={{ lineHeight: 1.6 }}>{f.tagline}</span>}
              {(f.company || f.address) && (
                <address className="small muted" style={{ fontStyle: 'normal', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {[f.company, f.address].filter(Boolean).join('\n')}
                </address>
              )}
              {f.email && <a href={`mailto:${f.email}`} className="small" style={{ color: 'var(--gold)' }}>{f.email}</a>}
              <a href="https://www.instagram.com/scoredateapp/" target="_blank" rel="noopener noreferrer" aria-label="ScoreDate on Instagram" className="row small" style={{ gap: 8, color: 'inherit', textDecoration: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
                @scoredateapp
              </a>
            </div>
            {f.columns.map(({ title, links }) => (
              <nav key={title} className="stack" style={{ gap: 10 }} aria-label={title}>
                <span className="label">{title}</span>
                {links.map(({ label: l, href }) => (
                  href.startsWith('/') && !href.includes('#')
                    ? <Link key={l + href} href={href} className="small" style={{ color: 'var(--muted)', textDecoration: 'none' }}>{l}</Link>
                    : <a key={l + href} href={href} className="small" style={{ color: 'var(--muted)', textDecoration: 'none' }}>{l}</a>
                ))}
              </nav>
            ))}
          </div>
          <div className="page small" style={{ padding: '18px 24px 32px', borderTop: '1px solid var(--line-soft)', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', color: 'var(--faint)' }}>
            <span>{f.copyright.replaceAll('{year}', String(new Date().getFullYear()))}</span>
            <ThemeSwitch />
          </div>
          {f.disclaimer && <p className="page small" style={{ padding: '0 24px 40px', color: 'var(--faint)', lineHeight: 1.6, margin: '0 auto' }}>
            {f.disclaimer}
          </p>}
        </footer>
  );
}
