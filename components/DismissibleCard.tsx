'use client';
import { useEffect, useState } from 'react';

/** A card the member can close; remembered on this device under `storageKey`. Renders nothing until checked, so no flash. */
export default function DismissibleCard({ storageKey, children, className = 'card stack' }: { storageKey: string; children: React.ReactNode; className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(!localStorage.getItem(storageKey)); } catch { setShow(true); } }, [storageKey]);
  if (!show) return null;
  return (
    <div className={className} style={{ gap: 8, position: 'relative' }}>
      <button type="button" aria-label="Dismiss" onClick={() => { try { localStorage.setItem(storageKey, '1'); } catch { /* storage blocked */ } setShow(false); }}
        style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 0, color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>×</button>
      {children}
    </div>
  );
}
