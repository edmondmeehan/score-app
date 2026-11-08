'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/app', label: 'Daily Drop', d: 'M12 3v12M6 11l6 6 6-6M5 21h14' },
  { href: '/app/search', label: 'Search and directory', d: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM21 21l-5.2-5.2', also: ['/app/discover', '/app/events', '/app/map', '/app/u/'] },
  { href: '/app/messages', label: 'Messages', d: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z' },
  { href: '/app/invites', label: 'Invites', d: 'M3 8h18v13H3zM3 10l9 6 9-6M8 8V4h8v4' },
  { href: '/app/settings', label: 'Me', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6' },
];

export default function TabBar() {
  const path = usePathname();
  // Inside a conversation the composer takes the bottom, like any messaging app.
  if (/^\/app\/messages\/[^/]+/.test(path)) return null;
  return (
    <nav className="tabbar icons" aria-label="App">
      {tabs.map((t) => {
        const on = t.href === '/app' ? path === '/app' : path.startsWith(t.href) || ('also' in t && !!t.also && t.also.some((a) => path.startsWith(a)));
        return (
          <Link key={t.href} href={t.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} aria-label={t.label} title={t.label}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.d} /></svg>
            <span className="sr-only">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
