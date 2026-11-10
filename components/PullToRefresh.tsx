'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import GaugeHeart from '@/components/GaugeHeart';
import { haptic } from '@/lib/haptics';

const PULL = 70; // how far (after resistance) to trigger
const HOLD = 56; // where the page rests while it refreshes
const MIN_SPIN = 750; // keep the heart up at least this long so it never just blinks
const EASE = 'cubic-bezier(.2,.8,.2,1)';
// Pages that scroll on their own or use drag gestures.
const SKIP = [/^\/app\/messages\/[^/]+/, /^\/app\/map/, /^\/app\/matchmaker/];

/**
 * Wraps the app pages. Pull down at the top: the page follows your finger with a rubber-band feel, clicks when it's
 * ready, eases into a resting spot while the gauge-heart plays, refreshes in place (no white flash), then glides back
 * with "Updated". Refreshing re-fetches the server data and remounts the page so client-loaded lists refresh too.
 */
export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [gen, setGen] = useState(0);
  const [pendingNav, start] = useTransition();
  const startY = useRef<number | null>(null);
  const armed = useRef(false);
  const t0 = useRef(0);

  // Finish: wait for the server refresh and the minimum spin, then glide back and show "Updated".
  useEffect(() => {
    if (!busy || pendingNav) return;
    const wait = Math.max(0, MIN_SPIN - (Date.now() - t0.current));
    const a = setTimeout(() => { setBusy(false); setDone(true); }, wait);
    return () => clearTimeout(a);
  }, [busy, pendingNav]);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1300);
    return () => clearTimeout(t);
  }, [done]);

  useEffect(() => {
    if (SKIP.some((r) => r.test(path))) return;
    const down = (e: TouchEvent) => {
      if (busy) return;
      startY.current = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
      armed.current = false;
    };
    const move = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) { setPull(0); setDragging(false); return; }
      setDragging(true);
      // Rubber band: easy at first, firmer the further you pull (never past ~130px).
      const p = 130 * (1 - Math.exp(-dy / 220));
      setPull(p);
      if (p >= PULL && !armed.current) { armed.current = true; haptic('medium'); }
      if (p < PULL - 6) armed.current = false;
    };
    const up = () => {
      if (startY.current === null) return;
      startY.current = null;
      setDragging(false);
      if (armed.current) {
        haptic('medium'); // the "click" on release (iPhone Safari only allows it inside the touch)
        t0.current = Date.now();
        setBusy(true);
        setPull(HOLD);
        start(() => { router.refresh(); setGen((g) => g + 1); });
      } else setPull(0);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); window.removeEventListener('touchcancel', up); };
  }, [path, router, busy]);

  // When the refresh finishes, let the page settle back.
  useEffect(() => { if (!busy && !dragging) setPull(0); }, [busy, dragging]);

  const offset = busy ? HOLD : pull;
  const progress = Math.min(1, pull / PULL);
  const motion = dragging ? 'none' : `transform .45s ${EASE}, opacity .3s ease`;
  return (
    <>
      <div className="ptr" aria-hidden={!busy} role="status" aria-label={busy ? 'Refreshing' : undefined}
        style={{
          transform: `translate(-50%, ${busy || done ? 14 : Math.max(-20, offset - 50)}px) scale(${busy || done ? 1 : 0.6 + 0.4 * progress})`,
          opacity: busy || done ? 1 : progress,
          width: done ? 'auto' : undefined, padding: done ? '0 14px' : undefined,
          transition: motion,
        }}>
        {done
          ? <span className="small" style={{ color: 'var(--gold-light)', whiteSpace: 'nowrap', fontWeight: 600 }}>Updated</span>
          : <GaugeHeart mode="loop" size={34} dur={1.6} paused={!busy} />}
      </div>
      {/* No transform at rest, so fixed-position pieces inside pages behave normally. */}
      <div key={gen} className="ptr-page" style={{ transform: offset ? `translateY(${offset}px)` : undefined, transition: motion, willChange: dragging ? 'transform' : undefined }}>
        {children}
      </div>
    </>
  );
}
