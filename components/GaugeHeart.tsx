'use client';
import { useEffect, useState } from 'react';

/**
 * The ScoreDate gauge morphing into a heart. Both shapes use the same four curves, so the browser can animate
 * between them (SVG <animate>, which works in Safari and the iPhone app). The gauge's two ends meet at the
 * heart's tip and the dot rides along.
 *   mode "heart": gauge → heart, then stays a heart (the match moment).
 *   mode "loop":  gauge → heart → gauge, repeating (pull to refresh).
 * People with "reduce motion" on see the end state without movement.
 */
const GAUGE = 'M24.54 75.46 C17.79 68.71 14 59.55 14 50 C14 30.12 30.12 14 50 14 C69.88 14 86 30.12 86 50 C86 59.55 82.21 68.71 75.46 75.46';
const HEART = 'M50 84 C40 76 14 60 14 40 C14 18 44 12 50 30 C56 12 86 18 86 40 C86 60 60 76 50 84';
const EASE = '0.6 0 0.2 1';

export default function GaugeHeart({ mode = 'heart', size = 120, dur = 1.4, delay = 0, paused = false }: { mode?: 'heart' | 'loop'; size?: number; dur?: number; delay?: number; paused?: boolean }) {
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false); }, []);
  const loop = mode === 'loop';
  const begin = `${delay}s`;
  if (still || paused) {
    const d = loop ? GAUGE : HEART;
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <path d={d} fill={loop ? 'none' : 'var(--gold)'} fillOpacity={loop ? 0 : 0.16} stroke="var(--gold)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={loop ? 75.46 : 50} cy={loop ? 75.46 : 84} r={6.5} fill="var(--ivory)" />
      </svg>
    );
  }
  const values = loop ? `${GAUGE};${HEART};${HEART};${GAUGE};${GAUGE}` : `${GAUGE};${HEART}`;
  const keyTimes = loop ? '0;0.35;0.5;0.85;1' : '0;1';
  const splines = loop ? `${EASE};0 0 1 1;${EASE};0 0 1 1` : EASE;
  const common = { begin, dur: `${dur}s`, calcMode: 'spline', keyTimes, keySplines: splines, repeatCount: loop ? 'indefinite' : undefined, fill: loop ? undefined : 'freeze' } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ overflow: 'visible' }}>
      <path d={GAUGE} fill="var(--gold)" fillOpacity={0} stroke="var(--gold)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round">
        <animate attributeName="d" values={values} {...common} />
        <animate attributeName="fill-opacity" values={loop ? '0;0.16;0.16;0;0' : '0;0.16'} {...common} />
      </path>
      <circle cx={75.46} cy={75.46} r={6.5} fill="var(--ivory)">
        <animate attributeName="cx" values={loop ? '75.46;50;50;75.46;75.46' : '75.46;50'} {...common} />
        <animate attributeName="cy" values={loop ? '75.46;84;84;75.46;75.46' : '75.46;84'} {...common} />
      </circle>
    </svg>
  );
}
