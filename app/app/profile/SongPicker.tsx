'use client';
import { useEffect, useRef, useState } from 'react';
import { setSong } from './actions';

type Track = { id: string; title: string; artist: string | null; image: string | null };

export default function SongPicker({ searchable }: { searchable: boolean }) {
  const [q, setQ] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!searchable) return;
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setTracks([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true); setErr(null);
      try {
        const res = await fetch('/api/spotify/search?q=' + encodeURIComponent(q));
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Search failed');
        setTracks(body.tracks || []);
      } catch (e) { setErr(e instanceof Error ? e.message : 'Search failed'); }
      setBusy(false);
    }, 350);
  }, [q, searchable]);

  return (
    <div className="stack" style={{ gap: 10 }}>
      {searchable && (
        <>
          <input className="input" placeholder="Search a song or artist" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search Spotify" />
          {busy && <span className="small muted">Searching…</span>}
          {err && <span className="small" style={{ color: 'var(--alert)' }}>{err}</span>}
          {tracks.map((t) => (
            <form key={t.id} action={setSong}>
              <input type="hidden" name="track" value={t.id} />
              <button className="list-row" style={{ width: '100%', background: 'transparent', border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer', padding: '6px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
                {t.image ? <img src={t.image} alt="" width={44} height={44} style={{ borderRadius: 6 }} /> : <span style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--track)' }} />}
                <span className="stack grow" style={{ gap: 2 }}><span>{t.title}</span><span className="small muted">{t.artist}</span></span>
                <span className="small" style={{ color: 'var(--gold)' }}>Pick</span>
              </button>
            </form>
          ))}
        </>
      )}
      <form action={setSong} className="row" style={{ gap: 8 }}>
        <input className="input grow" name="track" placeholder={searchable ? 'Or paste a Spotify song link' : 'Paste a Spotify song link'} />
        <button className="btn ghost sm">Add</button>
      </form>
      {!searchable && <span className="small muted">In Spotify, tap ••• on a song → Share → Copy song link.</span>}
    </div>
  );
}
