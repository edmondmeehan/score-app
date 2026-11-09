'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

/** The member's rotating QR pass. Fetches a fresh signed token every 30 seconds (and when the app comes back). */
export default function MemberPass() {
  const [svg, setSvg] = useState<string | null>(null);
  const [left, setLeft] = useState(30);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      const r = await fetch('/api/me/pass', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'unavailable');
      setSvg(await QRCode.toString(j.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B0B0C', light: '#FFFFFF' } }));
      setErr(null);
      const secs = Math.max(2, Number(j.expiresIn) || 30);
      setLeft(secs);
      timer.current = setTimeout(load, secs * 1000);
    } catch {
      setErr('Couldn’t load your pass. Check your connection.');
      timer.current = setTimeout(load, 5000);
    }
  }, []);

  useEffect(() => {
    load();
    const tick = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVis); if (timer.current) clearTimeout(timer.current); };
  }, [load]);

  return (
    <div className="pass-qr-wrap">
      <div className="pass-qr" aria-label="Your ScoreDate member pass QR code">
        {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="pass-qr-empty" />}
      </div>
      <div className="pass-timer" aria-live="polite">
        <span className="pass-bar"><span style={{ width: `${(left / 30) * 100}%` }} /></span>
        <span className="small muted">{err || `Refreshes in ${left}s · screenshots won’t work`}</span>
      </div>
    </div>
  );
}
