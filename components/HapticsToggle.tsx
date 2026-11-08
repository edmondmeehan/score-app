'use client';
import { useEffect, useState } from 'react';
import { haptic, hapticsOn, setHaptics } from '@/lib/haptics';

export default function HapticsToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => { setOn(hapticsOn()); }, []);
  return (
    <label className="choice" style={{ alignItems: 'flex-start' }}>
      <input type="checkbox" checked={on} onChange={(e) => { setHaptics(e.target.checked); setOn(e.target.checked); if (e.target.checked) haptic('medium'); }} style={{ accentColor: 'var(--gold)', marginTop: 4 }} />
      <span className="stack" style={{ gap: 2 }}><strong>Vibration feedback</strong><span className="small muted">Light taps when you press buttons, match or send. On supported phones.</span></span>
    </label>
  );
}
