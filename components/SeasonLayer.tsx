'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Effect } from '@/lib/seasons';

type Props = { seasonKey: string; name: string; banner: string; effect: Effect; preview?: boolean };

/** Seasonal banner + a short, light particle effect (once per visit; off for reduced motion). */
export default function SeasonLayer({ seasonKey, name, banner, effect, preview }: Props) {
  const path = usePathname();
  const [showBanner, setShowBanner] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const year = new Date().getFullYear();
  const dismissKey = `score_season_${seasonKey}_${year}`;
  const hidden = path.startsWith('/admin') || /^\/app\/messages\/[^/]+/.test(path) || path.startsWith('/maintenance');

  useEffect(() => {
    if (hidden) return;
    try { setShowBanner(preview || localStorage.getItem(dismissKey) !== '1'); } catch { setShowBanner(true); }
  }, [dismissKey, hidden, preview]);

  useEffect(() => {
    if (hidden || effect === 'none' || !canvas.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sessionKey = `score_season_fx_${seasonKey}`;
    try { if (!preview && sessionStorage.getItem(sessionKey)) return; sessionStorage.setItem(sessionKey, '1'); } catch { /* ignore */ }
    return runEffect(canvas.current, effect);
  }, [effect, seasonKey, hidden, preview]);

  if (hidden) return null;
  return (
    <>
      <canvas ref={canvas} aria-hidden style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 70 }} />
      {showBanner && banner && (
        <div className="season-banner" role="note">
          <span>{preview && <strong style={{ marginRight: 8 }}>Preview · {name}</strong>}{banner}</span>
          <button type="button" aria-label="Dismiss" onClick={() => { setShowBanner(false); try { localStorage.setItem(dismissKey, '1'); } catch { /* ignore */ } }}>×</button>
        </div>
      )}
    </>
  );
}

type P = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; c: string; life: number };
const COLORS: Record<Effect, string[]> = {
  none: [], snow: ['#FFFFFF', '#E9EEF5'], confetti: ['#F1DCA4', '#D9B86A', '#FFFFFF', '#E0E6F0'], hearts: ['#F0A9B6', '#D9788A', '#FFD3DB'],
  leaves: ['#C98E62', '#E3B48D', '#A85F3A', '#D9A441'], embers: ['#F4B57E', '#E8893A', '#FFD08A'], sparks: ['#FFFFFF', '#8FB4E8', '#D96B6B'],
};

function runEffect(cv: HTMLCanvasElement, effect: Effect) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  const W = () => innerWidth, H = () => innerHeight;
  const n = Math.min(70, Math.round(W() / 14));
  const cols = COLORS[effect];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const up = effect === 'embers';
  const make = (initial = false): P => ({
    x: effect === 'sparks' ? W() / 2 + rnd(-W() / 3, W() / 3) : rnd(0, W()),
    y: up ? H() + rnd(0, initial ? H() : 40) : effect === 'sparks' ? rnd(H() * .15, H() * .45) : rnd(initial ? -H() : -40, -10),
    vx: effect === 'sparks' ? rnd(-2.2, 2.2) : rnd(-.4, .4), vy: up ? rnd(-1.4, -.6) : effect === 'sparks' ? rnd(-2.2, 1.2) : rnd(.6, 1.8),
    r: effect === 'snow' ? rnd(1.5, 3.5) : effect === 'sparks' ? rnd(1.2, 2.4) : effect === 'hearts' ? rnd(9, 15) : rnd(4, 8), rot: rnd(0, Math.PI * 2), vr: rnd(-.05, .05),
    c: cols[Math.floor(Math.random() * cols.length)], life: 1,
  });
  let ps: P[] = Array.from({ length: n }, () => make(true));
  const start = performance.now();
  const RUN = 9000, FADE = 2500;
  let raf = 0; let lastBurst = 0;
  const draw = (p: P) => {
    ctx.save(); ctx.globalAlpha = p.life * .85; ctx.fillStyle = p.c; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (effect === 'hearts') { const s = p.r / 8; ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(0, 3); ctx.bezierCurveTo(-8, -4, -4, -10, 0, -5); ctx.bezierCurveTo(4, -10, 8, -4, 0, 3); ctx.fill(); }
    else if (effect === 'confetti') ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
    else if (effect === 'leaves') { ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r / 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  const tick = (t: number) => {
    const el = t - start;
    const fade = el > RUN ? Math.max(0, 1 - (el - RUN) / FADE) : 1;
    ctx.clearRect(0, 0, W(), H());
    if (effect === 'sparks' && el < RUN && t - lastBurst > 900) { lastBurst = t; ps = ps.concat(Array.from({ length: 24 }, () => make())).slice(-160); }
    for (const p of ps) {
      p.x += p.vx + (effect === 'snow' || effect === 'leaves' ? Math.sin((t + p.r * 100) / 900) * .4 : 0);
      p.y += p.vy; p.rot += p.vr;
      if (effect === 'sparks') { p.vy += .03; p.life -= .012; }
      if (el < RUN && effect !== 'sparks' && (p.y > H() + 20 || p.y < -60)) Object.assign(p, make());
      const keep = p.life; p.life = keep * fade; draw(p); p.life = keep;
    }
    if (effect === 'sparks') ps = ps.filter((p) => p.life > 0);
    if (fade > 0) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, W(), H());
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); };
}
