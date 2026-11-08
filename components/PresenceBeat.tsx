'use client';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

/** While the app is open and visible, tell the server "I'm here" every 2 minutes. Records nothing unless the member turned on "Show when I'm active". */
export default function PresenceBeat({ on }: { on: boolean }) {
  useEffect(() => {
    if (!on) return;
    const beat = () => { if (document.visibilityState === 'visible') supabaseBrowser().rpc('touch_presence').then(() => null, () => null); };
    beat();
    const t = setInterval(beat, 120000);
    document.addEventListener('visibilitychange', beat);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', beat); };
  }, [on]);
  return null;
}
