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

  const show = pending || pull > 8;
  const y = pending ? 24 : Math.max(0, pull - 28);
  return (
    <div className="ptr" aria-hidden={!pending} role="status" aria-label={pending ? 'Refreshing' : undefined}
      style={{ transform: `translate(-50%, ${y}px)`, opacity: show ? (pending ? 1 : Math.min(1, pull / PULL)) : 0, transition: pull ? 'none' : 'transform .25s, opacity .25s' }}>
      <GaugeHeart mode="loop" size={34} dur={1.6} paused={!pending} />
    </div>
  );
}
