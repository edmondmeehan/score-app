'use client';
import { useEffect, useState } from 'react';
import { haptic } from '@/lib/haptics';

/**
 * While a member's Spotlight is on, the app gets a soft gold glow around the edges and a small "In the Spotlight" pill.
 * The first time they see a new Spotlight: a haptic click and a brief pulse, so it feels like something happened.
 */
export default function SpotlightGlow({ until }: { until: string | null | undefined }) {
  const [on, setOn] = useState(false);
  const [pulse, setPulse] = useState(false);
  const end = until ? new Date(until).getTime() : 0;

  useEffect(() => {
    if (!end || end <= Date.now()) { setOn(false); return; }
    setOn(true);
    let seen = '';
    try { seen = localStorage.getItem('sd_spot_seen') || ''; } catch { /* ignore */ }
    if (seen !== String(end)) {
      haptic('success');
      setPulse(true);
      setTimeout(() => setPulse(false), 1600);
      try { localStorage.setItem('sd_spot_seen', String(end)); } catch { /* ignore */ }
    }
    const t = setTimeout(() => setOn(false), end - Date.now());
    return () => clearTimeout(t);
  }, [end]);

  useEffect(() => {
    document.documentElement.classList.toggle('spotlit', on);
    return () => document.documentElement.classList.remove('spotlit');
  }, [on]);

  if (!on) return null;
  const at = new Date(end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  return (
    <>
      <div className={`spot-glow${pulse ? ' pulse' : ''}`} aria-hidden="true" />
      <div className="spot-pill" role="status">✦ You’re in the Spotlight · until {at}</div>
    </>
  );
}
