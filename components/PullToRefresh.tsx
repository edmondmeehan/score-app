'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import GaugeHeart from '@/components/GaugeHeart';
import { haptic } from '@/lib/haptics';

const PULL = 72; // px to trigger
const MAX = 120;
// Pages that scroll on their own or use drag gestures.
const SKIP = [/^\/app\/messages\/[^/]+/, /^\/app\/map/, /^\/app\/matchmaker/];

/** Pull down at the top of any app page to refresh it. The gauge-heart loop plays while it reloads. */
export default function PullToRefresh() {
  const router = useRouter();
  const path = usePathname();
  const [pull, setPull] = useState(0);
  const [pending, start] = useTransition();
  const startY = useRef<number | null>(null);
  const armed = useRef(false);
  const [done, setDone] = useState(false);
  const was = useRef(false);
  // When a refresh finishes, show "Updated" for a moment so it's clear the page reloaded.
  useEffect(() => {
    if (was.current && !pending) { setDone(true); const t = setTimeout(() => setDone(false), 1400); was.current = false; return () => clearTimeout(t); }
    if (pending) was.current = true;
  }, [pending]);

  useEffect(() => {
    if (SKIP.some((r) => r.test(path))) return;
    const down = (e: TouchEvent) => { startY.current = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null; armed.current = false; };
    const move = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) { setPull(0); return; }
      const p = Math.min(MAX, dy * 0.5);
      setPull(p);
      if (p >= PULL && !armed.current) { armed.current = true; haptic('light'); }
      if (p < PULL) armed.current = false;
    };
    const up = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (armed.current) start(() => router.refresh());
      setPull(0);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); window.removeEventListener('touchcancel', up); };
  }, [path, router]);

  const show = pending || done || pull > 8;
  const y = pending || done ? 24 : Math.max(0, pull - 28);
  return (
    <div className="ptr" aria-hidden={!pending} role="status" aria-label={pending ? 'Refreshing' : undefined}
      style={{ transform: `translate(-50%, ${y}px)`, opacity: show ? (pending || done ? 1 : Math.min(1, pull / PULL)) : 0, width: done ? 'auto' : undefined, padding: done ? '0 14px' : undefined, transition: pull ? 'none' : 'transform .25s, opacity .25s' }}>
      {done ? <span className="small" style={{ color: 'var(--gold-light)', whiteSpace: 'nowrap', fontWeight: 600 }}>Updated</span> : <GaugeHeart mode="loop" size={34} dur={1.6} paused={!pending} />}
    </div>
  );
}
