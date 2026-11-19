import { requireStaff } from '@/lib/session';
import { APP_ENV } from '@/lib/appEnv';
import { BRANCHES, branchInfo, githubReady, pending, type BranchInfo } from '@/lib/github';
import { toLive, toStaging } from './actions';

export const dynamic = 'force-dynamic';

const when = (d?: string) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

function Stage({ title, url, info, note }: { title: string; url: string; info: BranchInfo; note: string }) {
  return (
    <div className="card stack" style={{ gap: 6, flex: '1 1 220px' }}>
      <span className="label">{title}</span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="small">{url.replace('https://', '')} ↗</a>
      {info ? (
        <>
          <span style={{ fontWeight: 600 }}>{info.message}</span>
          <span className="small muted mono">{info.sha.slice(0, 7)} · {when(info.date)}</span>
        </>
      ) : <span className="small muted">Not set up yet</span>}
      <span className="small muted">{note}</span>
    </div>
  );
}

export default async function Releases({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const { data: role } = await supabase.rpc('staff_role');
  const owner = role === 'owner';

  if (APP_ENV !== 'live') {
    return (
      <>
        <h1 className="serif" style={{ fontSize: 44 }}>Releases</h1>
        <div className="notice">You’re on <strong>{APP_ENV}</strong> (test data). Moving releases happens from the live admin: <a href="https://www.scoredate.app/admin/releases">www.scoredate.app/admin/releases</a>.</div>
      </>
    );
  }
  if (!githubReady()) {
    return (
      <>
        <h1 className="serif" style={{ fontSize: 44 }}>Releases</h1>
        <div className="notice error">Add a GitHub token (GITHUB_TOKEN) in Vercel with “Contents: Read and write” on the score-app repo.</div>
      </>
    );
  }

  const [dev, staging, live, devAhead, stagingAhead] = await Promise.all([
    branchInfo(BRANCHES.dev), branchInfo(BRANCHES.staging), branchInfo(BRANCHES.live),
    pending(BRANCHES.staging, BRANCHES.dev).catch(() => null), pending(BRANCHES.live, BRANCHES.staging).catch(() => null),
  ]);
  const toStagingN = staging ? devAhead?.count ?? 0 : (dev ? 1 : 0);
  const toLiveN = stagingAhead?.count ?? 0;

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Releases</h1>
      <p className="muted" style={{ margin: 0 }}>New work lands on Dev. When it looks good, move it to Staging for a final check, then go Live. Each move updates that site in about 2 minutes.</p>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <Stage title="1 · Dev" url="https://dev.scoredate.app" info={dev} note="Every push lands here. Test data." />
        <Stage title="2 · Staging" url="https://staging.scoredate.app" info={staging} note="Final check before live. Test data." />
        <Stage title="3 · Live" url="https://www.scoredate.app" info={live} note="What members see." />
      </div>

      <section className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>Move Dev → Staging</strong>
          <span className="small muted">{toStagingN ? `${toStagingN} change${toStagingN === 1 ? '' : 's'} waiting` : 'Staging already matches Dev'}</span>
        </div>
        {devAhead && devAhead.commits.length > 0 && <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{devAhead.commits.map((c) => <li key={c.sha}>{c.message} <span className="muted mono">{c.sha.slice(0, 7)}</span></li>)}</ul>}
        {owner ? (
          <form action={toStaging}><button className="btn sm" disabled={!toStagingN}>Move to Staging</button></form>
        ) : <span className="small muted">Only owners can move releases.</span>}
      </section>

      <section className="card stack" style={{ gap: 10, borderColor: 'var(--gold-edge)' }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>Move Staging → Live</strong>
          <span className="small muted">{toLiveN ? `${toLiveN} change${toLiveN === 1 ? '' : 's'} waiting` : 'Live already matches Staging'}</span>
        </div>
        {stagingAhead && stagingAhead.commits.length > 0 && <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{stagingAhead.commits.map((c) => <li key={c.sha}>{c.message} <span className="muted mono">{c.sha.slice(0, 7)}</span></li>)}</ul>}
        <span className="small muted">Before going live: run any new database changes (SQL) on the live database too, and check staging.scoredate.app on your phone.</span>
        {owner ? (
          <form action={toLive} className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ width: 180 }}>Type LIVE to confirm<input className="input" name="confirm" autoComplete="off" autoCapitalize="characters" placeholder="LIVE" /></label>
            <button className="btn sm" disabled={!toLiveN}>Go live</button>
          </form>
        ) : <span className="small muted">Only owners can go live.</span>}
      </section>
    </>
  );
}
