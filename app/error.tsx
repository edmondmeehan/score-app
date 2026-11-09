'use client';
import { useEffect } from 'react';

/** Friendly fallback instead of Next's blank "Application error". After a new release, an open page can call code that no longer exists, so reload once automatically. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = /Server Action|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|deployment/i.test(error?.message || '');
  useEffect(() => {
    console.error(error);
    if (!stale) return;
    try {
      // Reload at most once a minute, so a second update later in the same visit is also picked up.
      const last = Number(sessionStorage.getItem('sd-reloaded') || 0);
      if (Date.now() - last > 60000) { sessionStorage.setItem('sd-reloaded', String(Date.now())); window.location.reload(); }
    } catch { /* storage blocked */ }
  }, [error, stale]);
  return (
    <div className="phone" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div className="stack" style={{ gap: 12, maxWidth: 340 }}>
        <h1 className="serif" style={{ fontSize: 32, margin: 0 }}>{stale ? 'ScoreDate was just updated' : 'Something went wrong'}</h1>
        <p className="muted" style={{ margin: 0 }}>{stale ? 'Reload to get the latest version. Anything you already saved is still there.' : 'Try again. If it keeps happening, email support@scoredate.app.'}</p>
        <button className="btn block" onClick={() => { try { sessionStorage.removeItem('sd-reloaded'); } catch {} stale ? window.location.reload() : reset(); }}>{stale ? 'Reload' : 'Try again'}</button>
        {error?.digest && <span className="small muted mono">Ref {error.digest}</span>}
      </div>
    </div>
  );
}
