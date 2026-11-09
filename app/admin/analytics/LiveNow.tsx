'use client';
import { useEffect, useState } from 'react';
import { liveNow } from './actions';

type KV = { k: string; n: number };
export type Live = { total: number; members: number; visitors: number; app: number; web: number; today: number; pages: KV[]; cities: KV[]; at: string } | null;

/** Live count, refreshed every 20 seconds. "On now" = a page open and visible in the last 2 minutes. */
export default function LiveNow({ initial }: { initial: Live }) {
  const [d, setD] = useState<Live>(initial);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') liveNow().then((x) => x && setD(x)).catch(() => null); }, 20000);
    return () => clearInterval(t);
  }, []);
  if (!d) return <section className="card"><span className="small muted">Right now needs migration 0046.</span></section>;
  const tiles: [string, number][] = [['Members', d.members], ['Visitors (signed out)', d.visitors], ['In the iPhone app', d.app], ['On the website', d.web]];
  return (
    <section className="card stack live-now" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span className="row" style={{ gap: 8 }}><span className="live-dot" aria-hidden /><strong>Right now</strong></span>
        <span className="small muted">Updated {new Date(d.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York' })} · {d.today} today · staff excluded</span>
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 10 }}><span className="serif" style={{ fontSize: 56, lineHeight: 1, color: 'var(--gold-light)' }}>{d.total}</span><span className="muted">{d.total === 1 ? 'person' : 'people'} on ScoreDate</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {tiles.map(([l, n]) => <div key={l} className="stack" style={{ gap: 2 }}><span className="serif" style={{ fontSize: 26 }}>{n}</span><span className="small muted">{l}</span></div>)}
      </div>
      {(d.pages.length > 0 || d.cities.length > 0) && (
        <div className="row" style={{ gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {d.pages.length > 0 && <div className="stack small" style={{ gap: 4 }}><span className="muted">Pages open</span>{d.pages.map((p) => <span key={p.k} className="mono">{p.n} · {p.k}</span>)}</div>}
          {d.cities.length > 0 && <div className="stack small" style={{ gap: 4 }}><span className="muted">Where</span>{d.cities.map((c) => <span key={c.k}>{c.n} · {c.k}</span>)}</div>}
        </div>
      )}
    </section>
  );
}
