'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/ui';
import ThemeSwitch from '@/components/ThemeSwitch';
import { BUILD_LABEL } from '@/components/AppFooter';

export default function AdminNav({ counts, email }: { counts: { rep: number; ver: number; del: number; sup: number }; email: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [open]);
  const items = [
    ['/admin', 'Overview', 0], ['/admin/analytics', 'Analytics', 0], ['/admin/map', 'Map', 0], ['/admin/waitlist', 'Waitlist & invites', 0], ['/admin/verification', 'Verification', counts.ver],
    ['/admin/moderation', 'Moderation', counts.rep], ['/admin/support', 'Support', counts.sup], ['/admin/members', 'Members', 0], ['/admin/events', 'Events', 0], ['/admin/content', 'Content', 0], ['/admin/deletions', 'Deletions', counts.del], ['/admin/billing', 'Billing', 0], ['/admin/emails', 'Emails', 0], ['/admin/integrations', 'Integrations', 0], ['/admin/security', 'Security', 0], ['/admin/audit', 'Audit log', 0],
  ] as const;
  const isOn = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  const current = items.find(([href]) => isOn(href))?.[1] ?? 'Admin';
  const pending = counts.rep + counts.ver + counts.del + counts.sup;

  return (
    <>
      {/* Phones: compact sticky bar with a menu button */}
      <header className="admin-bar">
        <Logo size={13} />
        <span className="admin-bar-title">{current}</span>
        <button type="button" className="admin-menu-btn" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Menu'}
          {!open && pending > 0 && <span className="admin-dot" aria-label={`${pending} waiting`}>{pending}</span>}
        </button>
      </header>
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} aria-hidden />}
      <nav id="admin-nav" aria-label="Admin" className={open ? 'open' : ''}>
        <div className="admin-nav-logo" style={{ padding: '0 10px 18px' }}><Logo size={14} /></div>
        {items.map(([href, label, n]) => (
          <Link key={href} href={href} className={isOn(href) ? 'on' : ''}>
            {label}{n ? <span style={{ color: href === '/admin/moderation' ? 'var(--alert)' : 'var(--gold)' }}> · {n}</span> : null}
          </Link>
        ))}
        <span className="small muted" style={{ padding: '18px 12px 0', overflowWrap: 'anywhere' }}>{email}</span>
        <Link href="/app" className="small" style={{ padding: '6px 12px' }}>Back to app</Link>
        <div style={{ padding: '10px 8px' }}><ThemeSwitch /></div>
        <span className="mono" style={{ padding: '4px 12px', fontSize: 10, color: 'var(--faint)' }}>{BUILD_LABEL}</span>
      </nav>
    </>
  );
}
