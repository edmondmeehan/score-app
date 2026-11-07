import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

type TocItem = { id: string; h: string };

/** Shared layout for info and policy pages: header, hero, sticky contents (collapsible on phones), footer. */
export default function DocLayout({ eyebrow, title, summary, updated, toc, children, wide = false }:
  { eyebrow: string; title: string; summary: string; updated?: string; toc?: TocItem[]; children: React.ReactNode; wide?: boolean }) {
  return (
    <div>
      <SiteHeader />
      <div className="page doc-hero">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="serif">{title}</h1>
        <p>{summary}</p>
        {updated && <span className="small muted" style={{ display: 'block', marginTop: 14 }}>Last updated {updated}</span>}
      </div>
      {toc && toc.length > 0 && !wide ? (
        <div className="page doc-wrap">
          <nav className="doc-toc" aria-label="On this page">
            <span className="label" style={{ marginBottom: 4 }}>On this page</span>
            {toc.map((t) => <a key={t.id} href={`#${t.id}`}>{t.h}</a>)}
          </nav>
          <div className="doc-body">
            <details className="doc-toc-mobile">
              <summary>On this page</summary>
              <nav aria-label="On this page">{toc.map((t) => <a key={t.id} href={`#${t.id}`}>{t.h}</a>)}</nav>
            </details>
            {children}
          </div>
        </div>
      ) : (
        <div className="page" style={{ padding: '8px 20px 72px' }}><div className="doc-body" style={{ maxWidth: wide ? 'none' : 720 }}>{children}</div></div>
      )}
      <SiteFooter />
    </div>
  );
}
