'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** About once a minute while the page is visible, let the server know someone's here (for the admin "Right now" count). */
export default function LiveBeat() {
  const path = usePathname();
  useEffect(() => {
    if (path?.startsWith('/admin')) return;
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/live', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }), keepalive: true }).catch(() => null);
    };
    beat();
    const t = setInterval(beat, 60000);
    document.addEventListener('visibilitychange', beat);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', beat); };
  }, [path]);
  return null;
}
