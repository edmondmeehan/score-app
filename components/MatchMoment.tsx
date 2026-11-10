'use client';
import { useEffect, useState } from 'react';
import GaugeHeart from '@/components/GaugeHeart';
import { haptic } from '@/lib/haptics';

/** Full-screen "It's a match" moment: the gauge turns into a heart, then fades to reveal the chat. Tap to skip. */
export default function MatchMoment({ name }: { name?: string | null }) {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');
  useEffect(() => {
    const h = setTimeout(() => haptic('success'), 900);
    const a = setTimeout(() => setPhase('out'), 2900);
    const b = setTimeout(() => setPhase('gone'), 3400);
    return () => { clearTimeout(h); clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === 'gone') return null;
  const skip = () => { setPhase('out'); setTimeout(() => setPhase('gone'), 400); };
  return (
    <div className={`match-moment ${phase === 'out' ? 'out' : ''}`} role="dialog" aria-label="It's a match" onClick={skip}>
      <GaugeHeart mode="heart" size={168} dur={1.3} delay={0.25} />
      <div className="serif" style={{ fontSize: 44, lineHeight: 1.05, marginTop: 18 }}>It’s a match.</div>
      <div className="muted" style={{ marginTop: 8 }}>{name ? `You and ${name} both said yes.` : 'You both said yes.'}</div>
      <div className="small" style={{ marginTop: 26, color: 'var(--faint)' }}>Tap to start talking</div>
    </div>
  );
}
