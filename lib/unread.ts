'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

/** Red number on the app icon: the iPhone app (Badge plugin) and installed web apps (Badging API). */
function setAppBadge(n: number) {
  try {
    const Badge = (window as any).Capacitor?.Plugins?.Badge;
    if (Badge) { (n > 0 ? Badge.set({ count: n }) : Badge.clear()).catch?.(() => null); return; }
    const nav = navigator as any;
    if (n > 0) nav.setAppBadge?.(n)?.catch?.(() => null); else nav.clearAppBadge?.()?.catch?.(() => null);
  } catch { /* not supported */ }
}

/**
 * Unread messages for the signed-in member. Refreshes when the screen changes, when the app comes back to the
 * front, when a push arrives (NativePush fires "sd:push"), and every 30 seconds while the app is open.
 */
export function useUnreadMessages(path: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      supabaseBrowser().rpc('my_unread_messages').then(({ data, error }) => {
        if (!alive || error) return;
        const v = Number(data) || 0;
        setN(v); setAppBadge(v);
      }, () => null);
    };
    load();
    const t = setInterval(load, 30_000);
    const onVis = () => load();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    window.addEventListener('sd:push', onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); window.removeEventListener('sd:push', onVis); };
  }, [path]);
  return n;
}
