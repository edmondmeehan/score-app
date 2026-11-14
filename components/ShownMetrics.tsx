'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Shown.io metrics: homepage and /meet only (the public waitlist pages), never inside the iPhone app. */
export default function ShownMetrics() {
  const path = usePathname();
  useEffect(() => {
    if (path !== '/' && path !== '/meet') return;
    if (/ScoreDateApp/.test(navigator.userAgent) || document.getElementById('shown-metrics')) return;
    const s = document.createElement('script');
    s.id = 'shown-metrics'; s.defer = true; s.src = 'https://shown.io/metrics/V40zqXKR9r';
    document.head.appendChild(s);
  }, [path]);
  return null;
}
