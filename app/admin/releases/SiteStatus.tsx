'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import type { Build } from '@/lib/vercelDeploys';

const TYPICAL_MS = 90_000;           // a ScoreDate build usually takes 60–100 seconds
const WAITING = new Set(['QUEUED', 'INITIALIZING', 'BUILDING']);

type Info = { sha: string; message: string; date: string } | null;

/** One site card: what it's on, and a progress bar while Vercel rebuilds it. Polls until the site is up to date. */
export default function SiteStatus({ site, title, url, note, info, build: initial }: { site: string; title: string; url: string; note: string; info: Info; build: Build }) {
  const router = useRouter();
  const [build, setBuild] = useState<Build>(initial);
  const [branchSha, setBranchSha] = useState(info?.sha || null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const started = useRef(Date.now());

  const behind = Boolean(branchSha && build && build.sha && build.sha !== branchSha);
  const building = Boolean(build && WAITING.has(build.state));
  const failed = build?.state === 'ERROR' || build?.state === 'CANCELED';
  const active = building || behind;
  const settledRef = useRef(!active);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    const tick = setInterval(() => setNow(Date.now()), 500);
    const poll = async () => {
      if (stop) return;
      try {
        const r = await fetch(`/api/staff/releases?site=${site}`, { cache: 'no-store' });
        if (r.ok) { const d = (await r.json()) as { sha: string | null; build: Build }; setBuild(d.build); if (d.sha) setBranchSha(d.sha); }
      } catch { /* try again */ }
      if (!stop && Date.now() - started.current < 15 * 60_000) setTimeout(poll, 4000);
    };
    const t = setTimeout(poll, 2500);
    return () => { stop = true; clearInterval(tick); clearTimeout(t); };
  }, [active, site]);

  // When a build finishes, refresh the page so the change lists and "will move" counts update.
  useEffect(() => {
    if (!active && !settledRef.current) { settledRef.current = true; router.refresh(); }
    if (active) settledRef.current = false;
  }, [active, router]);

  const elapsed = building && build ? Math.max(0, now - build.created) : 0;
  const pct = building ? Math.min(96, Math.round((elapsed / TYPICAL_MS) * 100)) : 0;
  const stuck = behind && !building && now - started.current > 90_000;

  async function startBuild() {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/staff/releases?site=${site}`, { method: 'POST' }).then((x) => x.json()).catch(() => ({ ok: false, message: 'Couldn’t reach the server' }));
    setBusy(false); setMsg(r.ok ? 'Build started.' : r.message || 'Couldn’t start a build');
    if (r.ok) { started.current = Date.now(); setBuild((b) => (b ? { ...b, state: 'QUEUED', created: Date.now() } : b)); }
  }

  return (
    <div className="card stack" style={{ gap: 6, flex: '1 1 240px' }}>
      <span className="label">{title}</span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="small">{url.replace('https://', '')} ↗</a>
      {info ? (
        <>
          <span style={{ fontWeight: 600 }}>{info.message}</span>
          <span className="small muted mono">{info.sha.slice(0, 7)} · {info.date}</span>
        </>
      ) : <span className="small muted">Not set up yet</span>}

      {build && (
        building ? (
          <div className="stack" style={{ gap: 4 }} role="status" aria-live="polite">
            <div className="release-bar" aria-label={`Updating, about ${pct}%`}><span style={{ width: `${pct}%` }} /></div>
            <span className="small" style={{ color: 'var(--gold-light)' }}>
              {build.state === 'BUILDING' ? 'Updating' : 'Starting'} · {Math.floor(elapsed / 1000)}s{elapsed > TYPICAL_MS * 1.6 ? ' (taking longer than usual)' : ''}
            </span>
          </div>
        ) : behind ? (
          <div className="stack" style={{ gap: 4 }} role="status" aria-live="polite">
            <div className="release-bar waiting" aria-label="Waiting for the build to start"><span /></div>
            <span className="small muted">Waiting for the update to start…</span>
            {stuck && (
              <span className="small">The build hasn’t started on its own.{' '}
                <button type="button" className="btn ghost sm" onClick={startBuild} disabled={busy}>{busy ? 'Starting…' : 'Start it'}</button>
              </span>
            )}
          </div>
        ) : failed ? (
          <span className="small" style={{ color: 'var(--alert)' }}>Last update failed, so the site is still on the previous version. <a href={build.url} target="_blank" rel="noopener noreferrer">See why ↗</a></span>
        ) : (
          <span className="small" style={{ color: 'var(--ok, #5FB07D)' }}>✓ Up to date</span>
        )
      )}
      {msg && <span className="small muted">{msg}</span>}
      <span className="small muted">{note}</span>
    </div>
  );
}

/** Submit button that shows a moving bar while the move is being made. */
export function MoveButton({ label, busy, disabled }: { label: string; busy: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="stack" style={{ gap: 6, alignItems: 'flex-start' }}>
      <button className="btn sm" disabled={disabled || pending}>{pending ? busy : label}</button>
      {pending && <div className="release-bar waiting" style={{ width: 200 }}><span /></div>}
    </div>
  );
}
