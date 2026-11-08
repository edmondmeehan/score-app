'use client';
import { useState } from 'react';
import { haptic } from '@/lib/haptics';

/** Shares only your own result: no names or photos of the other person. */
export default function ShareCompat({ score }: { score: number }) {
  const [done, setDone] = useState(false);
  const text = `I just went ${score}% financially compatible on ScoreDate, before seeing a single photo. Now let’s see if there’s chemistry.`;
  const share = async () => {
    haptic('light');
    const url = 'https://www.scoredate.app';
    try {
      if (navigator.share) await navigator.share({ text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); setDone(true); }
    } catch { /* cancelled */ }
  };
  return (
    <button type="button" className="btn ghost block" onClick={share}>{done ? 'Copied. Paste it anywhere' : 'Share my result'}</button>
  );
}
