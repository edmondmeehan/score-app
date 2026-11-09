'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/ui';
import ThemeSwitch from '@/components/ThemeSwitch';
import { BUILD_LABEL } from '@/lib/build';

export default function AdminNav({ counts, email }: { counts: { rep: number; ver: number; del: number; sup: number }; email: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [open]);
  const groups: { title: string; items: [string, string, number][] }[] = [
    { title: 'Dashboard', items: [['/admin', 'Overview', 0], ['/admin/analytics', 'Analytics', 0], ['/admin/health', 'Site health', 0], ['/admin/reports', 'Daily report', 0], ['/admin/map', 'Map', 0]] },
    { title: 'Growth', items: [['/admin/waitlist', 'Waitlist & invites', 0], ['/admin/campaigns', 'Campaigns', 0], ['/admin/featured', 'Featured spots', 0], ['/admin/investors', 'Investors', 0]] },
    { title: 'Members', items: [['/admin/members', 'Members', 0], ['/admin/reserve', 'Reserve', 0], ['/admin/verification', 'Verification', counts.ver], ['/admin/support', 'Support', counts.sup], ['/admin/deletions', 'Deletions', counts.del]] },
    { title: 'Trust & safety', items: [['/admin/moderation', 'Moderation', counts.rep], ['/admin/flags', 'Flagged messages', 0], ['/admin/screenshots', 'Screenshots', 0], ['/admin/security', 'Security', 0], ['/admin/audit', 'Audit log', 0]] },
    { title: 'Content', items: [['/admin/content', 'Content', 0], ['/admin/events', 'Events', 0], ['/admin/date-challenge', '$50 Date Challenge', 0], ['/admin/emails', 'Emails', 0], ['/admin/footer', 'Footer', 0], ['/admin/themes', 'Seasonal themes', 0]] },
    { title: 'Business', items: [['/admin/billing', 'Billing', 0], ['/admin/integrations', 'Integrations', 0], ['/admin/team', 'Admins', 0]] },
  ];
  const items = groups.flatMap((g) => g.items);
  const isOn = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  // Accordion: one section open at a time. The section holding the current page opens on each navigation.
  const activeGroup = groups.find((g) => g.items.some(([href]) => isOn(href)))?.title ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  useEffect(() => { setOpenGroup(activeGroup); }, [activeGroup]);
  const toggleGroup = (t: string) => setOpenGroup((cur) => (cur === t ? null : t));
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
        {groups.map((g) => {
          const active = g.items.some(([href]) => isOn(href));
          const isOpen = openGroup === g.title;
          const waiting = g.items.reduce((s2, [, , n]) => s2 + (Number(n) || 0), 0);
          return (
            <div key={g.title} className={`admin-nav-group${isOpen ? ' open' : ''}${active ? ' active' : ''}`} role="group" aria-label={g.title}>
              <button type="button" className="admin-nav-head" aria-expanded={isOpen} onClick={() => toggleGroup(g.title)}>
                <span>{g.title}</span>
                <span className="admin-nav-meta">{!isOpen && waiting > 0 && <span className="admin-nav-count">{waiting}</span>}<span className="admin-nav-chev" aria-hidden>{isOpen ? '−' : '+'}</span></span>
              </button>
              {isOpen && <div className="admin-nav-items">{g.items.map(([href, label, n]) => (
                <Link key={href} href={href} className={isOn(href) ? 'on' : ''} aria-current={isOn(href) ? 'page' : undefined}>
                  {label}{n ? <span style={{ color: href === '/admin/moderation' ? 'var(--alert)' : 'var(--gold)' }}> · {n}</span> : null}
                </Link>
              ))}</div>}
            </div>
          );
        })}
        <div className="theme-switch admin-account" role="group" aria-label="Account">
          <span className="admin-account-email" title={email}>{email}</span>
          <Link href="/app">Back to app</Link>
        </div>
        <div style={{ padding: '8px 0 0' }}><ThemeSwitch /></div>
        <span className="mono" style={{ padding: '6px 6px', fontSize: 10, color: 'var(--faint)' }}>{BUILD_LABEL}</span>
      </nav>
    </>
  );
}
