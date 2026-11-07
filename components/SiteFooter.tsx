import Link from 'next/link';
import { Logo } from '@/components/ui';
import ThemeSwitch from '@/components/ThemeSwitch';

/** Public-site footer, shared by the home page and every info/legal page. */
export default function SiteFooter() {
  return (
        <footer style={{ borderTop: '1px solid var(--line-soft)', background: 'var(--graphite)' }}>
          <div className="page site-footer" style={{ padding: '56px 24px 28px' }}>
            <div className="stack site-footer-brand" style={{ gap: 12 }}>
              <Logo />
              <span className="small muted" style={{ lineHeight: 1.6 }}>The invite-only dating app built on verified credit bands. Now open in New York City.</span>
              <address className="small muted" style={{ fontStyle: 'normal', lineHeight: 1.6 }}>
                Please &amp; Thank You, Inc.<br />1133 Broadway, Suite 1301<br />New York, NY 10010
              </address>
              <a href="mailto:support@scoredate.app" className="small" style={{ color: 'var(--gold)' }}>support@scoredate.app</a>
            </div>
            {([
              ['Score', [['How it works', '/#how'], ['Where we’re live', '/#where'], ['Request an invite', '/#invite'], ['I have a code', '/join'], ['Sign in', '/signin']]],
              ['Trust & safety', [['Safety center', '/safety'], ['Community guidelines', '/legal/community'], ['Biometric data policy', '/legal/biometric'], ['Report a concern', '/safety#report']]],
              ['Company', [['Partners', '/partners'], ['Press', '/press'], ['Contact', '/contact']]],
              ['Legal', [['Terms of Service', '/legal/terms'], ['Privacy Policy', '/legal/privacy'], ['Your privacy choices', '/legal/choices'], ['Cookie notice', '/legal/cookies']]],
            ] as const).map(([title, links]) => (
              <nav key={title} className="stack" style={{ gap: 10 }} aria-label={title}>
                <span className="label">{title}</span>
                {links.map(([l, href]) => (
                  href.startsWith('/') && !href.includes('#')
                    ? <Link key={l} href={href} className="small" style={{ color: 'var(--muted)', textDecoration: 'none' }}>{l}</Link>
                    : <a key={l} href={href} className="small" style={{ color: 'var(--muted)', textDecoration: 'none' }}>{l}</a>
                ))}
              </nav>
            ))}
          </div>
          <div className="page small" style={{ padding: '18px 24px 32px', borderTop: '1px solid var(--line-soft)', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', color: 'var(--faint)' }}>
            <span>© {new Date().getFullYear()} Please &amp; Thank You, Inc. All rights reserved. Members must be 25+.</span>
            <ThemeSwitch />
          </div>
          <p className="page small" style={{ padding: '0 24px 40px', color: 'var(--faint)', lineHeight: 1.6, margin: '0 auto' }}>
            Score is not a credit bureau, lender or credit repair service. Checking your band uses a soft inquiry that does not affect your credit score. Score never sees or stores your exact score or credit report. In an emergency, call 911.
          </p>
        </footer>
  );
}
