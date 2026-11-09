'use client';
import { useEffect, useState } from 'react';

/** Counts down to the next Daily Drop (00:00 UTC). Reloads the page once it lands so the new people show up. */
export default function DropCountdown({ at, label }: { at: string; label: string }) {
  const target = new Date(at).getTime();
  const [left, setLeft] = useState(() => target - Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const ms = target - Date.now();
      setLeft(ms);
      if (ms <= 0) { clearInterval(t); setTimeout(() => window.location.reload(), 1500); }
    }, 1000);
    return () => clearInterval(t);
  }, [target]);
  if (left <= 0) return <div className="drop-countdown"><span className="label">New Drop</span><span className="mono">Landing now…</span></div>;
  const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="drop-countdown" aria-label={`Next Drop in ${h} hours ${m} minutes`}>
      <span className="label">Next Drop · {label}</span>
      <span className="mono" suppressHydrationWarning>{h}:{pad(m)}:{pad(s)}</span>
    </div>
  );
}
