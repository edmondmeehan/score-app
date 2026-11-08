'use client';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0d0d0f', color: '#f3eee4', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div style={{ maxWidth: 340 }}>
          <h1 style={{ fontSize: 28, fontWeight: 500 }}>Something went wrong</h1>
          <p style={{ opacity: 0.7 }}>ScoreDate may have just been updated. Reload to continue.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: '12px 22px', borderRadius: 999, border: 0, background: '#c9a24a', color: '#111', fontSize: 15 }}>Reload</button>
          {error?.digest && <p style={{ opacity: 0.4, fontSize: 12, marginTop: 16 }}>Ref {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
