'use client';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { haptic } from '@/lib/haptics';

/** The icon pulses while its screen loads, so a tap always feels answered. */
function TabIcon({ d }: { d: string }) {
  const { pending } = useLinkStatus();
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={pending ? { animation: 'tabpulse .9s ease-in-out infinite' } : undefined}><path d={d} /></svg>;
}

const tabs = [
  { href: '/app', label: 'Daily Drop', d: 'M12 3v12M6 11l6 6 6-6M5 21h14' },
  { href: '/app/search', label: 'Search and directory', d: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM21 21l-5.2-5.2', also: ['/app/discover', '/app/map', '/app/u/'] },
  { href: '/app/events', label: 'Events', d: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M8 14h3v3H8z' },
  { href: '/app/messages', label: 'Messages', d: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z' },
  { href: '/app/giveaways', label: 'Giveaways', d: 'M3 10h18v4H3zM5 14h14v7H5zM12 10v11M12 10c-2-4-6-4-6-1.5S10 10 12 10zM12 10c2-4 6-4 6-1.5S14 10 12 10z' },
  { href: '/app/settings', label: 'Me', also: ['/app/invites'], d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6' },
];

export default function TabBar() {
  const path = usePathname();
  // Highlight the tapped tab immediately, before its screen has loaded.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => { setTapped(null); }, [path]);
  // Inside a conversation the composer takes the bottom, like any messaging app.
  if (/^\/app\/messages\/[^/]+/.test(path)) return null;
  return (
    <nav className="tabbar icons" aria-label="App">
      {tabs.map((t) => {
        const current = t.href === '/app' ? path === '/app' : path.startsWith(t.href) || ('also' in t && !!t.also && t.also.some((a) => path.startsWith(a)));
        const on = tapped ? tapped === t.href : current;
        return (
          <Link key={t.href} href={t.href} className={on ? 'on' : ''} aria-current={current ? 'page' : undefined} aria-label={t.label} title={t.label}
            onClick={() => { if (!current) { setTapped(t.href); haptic('selection'); } }}>
            <TabIcon d={t.d} />
            <span className="sr-only">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
