import { requireStaff } from '@/lib/session';
import { APP_ENV } from '@/lib/appEnv';
import { BRANCHES, branchInfo, fileAt, githubProblem, githubReady, pending, type Pending } from '@/lib/github';
import { latestBuild } from '@/lib/vercelDeploys';
import { toLive, toStaging } from './actions';
import SiteStatus, { MoveButton } from './SiteStatus';

export const dynamic = 'force-dynamic';

const when = (d?: string | number) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

/** The list of changes a move will bring, plus any database changes that must be run first. */
async function Changes({ p, head, liveDb }: { p: Pending | null; head: string; liveDb: boolean }) {
  if (!p || p.commits.length === 0) return null;
  const sql = liveDb && p.migrations.length ? await Promise.all(p.migrations.map(async (f) => ({ f, text: await fileAt(f, head) }))) : [];
  return (
    <div className="stack" style={{ gap: 10 }}>
      <ol className="release-list">
        {p.commits.map((c) => (
          <li key={c.sha}>
            <span>{c.message}</span>
            <span className="small muted mono">{c.sha.slice(0, 7)} · {when(c.date)}</span>
          </li>
        ))}
      </ol>
      {p.count > p.commits.length && <span className="small muted">…and {p.count - p.commits.length} earlier changes.</span>}
      {p.migrations.length > 0 && (
        <div className="notice" style={{ borderColor: 'var(--gold-edge)' }}>
          <strong>Database changes in this move ({p.migrations.length}).</strong>{' '}
          {liveDb ? 'Run these on the LIVE database (Supabase → SQL Editor) before you press Go live:' : 'They’re already on the test database if you ran them there. Run them on the live database before going live.'}
          <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{p.migrations.map((m) => <li key={m} className="mono">{m.replace('supabase/migrations/', '')}</li>)}</ul>
          {sql.map(({ f, text }) => text && (
            <details key={f} style={{ marginTop: 8 }}>
              <summary className="small">Show SQL for {f.replace('supabase/migrations/', '')}</summary>
              <pre className="release-sql">{text}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

type LogRow = { id: number; staff_email: string; action: string; reason: string | null; created_at: string };

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
  const problem = await githubProblem();
  if (problem) {
    return (
      <>
        <h1 className="serif" style={{ fontSize: 44 }}>Releases</h1>
        <div className="notice error">{problem}</div>
        <p className="small muted" style={{ margin: 0 }}>GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token. Repository access: only edmondmeehan/score-app. Permissions: Contents “Read and write” (Metadata “Read” is added automatically). Then paste it as GITHUB_TOKEN in Vercel (Production) and redeploy.</p>
      </>
    );
  }

  const [dev, staging, live, devAhead, stagingAhead, bDev, bStaging, bLive, logRes] = await Promise.all([
    branchInfo(BRANCHES.dev), branchInfo(BRANCHES.staging), branchInfo(BRANCHES.live),
    pending(BRANCHES.staging, BRANCHES.dev).catch(() => null), pending(BRANCHES.live, BRANCHES.staging).catch(() => null),
    latestBuild(BRANCHES.dev), latestBuild(BRANCHES.staging), latestBuild(BRANCHES.live, true),
    supabase.from('audit_log').select('id, staff_email, action, reason, created_at').in('action', ['release_staging', 'release_live']).order('created_at', { ascending: false }).limit(15),
  ]);
  const history = (logRes.data || []) as LogRow[];
  const toStagingN = staging ? devAhead?.count ?? 0 : (dev ? 1 : 0);
  const toLiveN = stagingAhead?.count ?? 0;

  const sites = [
    { key: 'dev', title: '1 · Dev', url: 'https://dev.scoredate.app', note: 'Every push lands here. Test data.', info: dev, build: bDev },
    { key: 'staging', title: '2 · Staging', url: 'https://staging.scoredate.app', note: 'Final check before live. Test data.', info: staging, build: bStaging },
    { key: 'live', title: '3 · Live', url: 'https://www.scoredate.app', note: 'What members see.', info: live, build: bLive },
  ] as const;

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Releases</h1>
      <p className="muted" style={{ margin: 0 }}>New work lands on Dev. When it looks good, move it to Staging for a final check, then go Live. Each move rebuilds that site; the bar shows when it’s ready.</p>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {sites.map((s) => (
          <SiteStatus key={s.key} site={s.key} title={s.title} url={s.url} note={s.note}
            info={s.info ? { sha: s.info.sha, message: s.info.message, date: when(s.info.date) } : null}
            build={s.build} />
        ))}
      </div>

      <section className="card stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>Move Dev → Staging</strong>
          <span className="small muted">{toStagingN ? `${toStagingN} change${toStagingN === 1 ? '' : 's'} will move` : 'Staging already matches Dev'}</span>
        </div>
        <Changes p={devAhead} head={BRANCHES.dev} liveDb={false} />
        {owner ? (
          <form action={toStaging}><MoveButton label="Move to Staging" busy="Moving to Staging…" disabled={!toStagingN} /></form>
        ) : <span className="small muted">Only owners can move releases.</span>}
      </section>

      <section className="card stack" style={{ gap: 12, borderColor: 'var(--gold-edge)' }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>Move Staging → Live</strong>
          <span className="small muted">{toLiveN ? `${toLiveN} change${toLiveN === 1 ? '' : 's'} will go live` : 'Live already matches Staging'}</span>
        </div>
        <Changes p={stagingAhead} head={BRANCHES.staging} liveDb />
        {toLiveN > 0 && <span className="small muted">Check staging.scoredate.app on your phone first.</span>}
        {owner ? (
          <form action={toLive} className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ width: 180 }}>Type LIVE to confirm<input className="input" name="confirm" autoComplete="off" autoCapitalize="characters" placeholder="LIVE" /></label>
            <MoveButton label="Go live" busy="Going live…" disabled={!toLiveN} />
          </form>
        ) : <span className="small muted">Only owners can go live.</span>}
      </section>

      <section className="card stack" style={{ gap: 10 }}>
        <strong>History</strong>
        {history.length === 0 ? <span className="small muted">No releases moved from here yet.</span> : (
          <ul className="release-history">
            {history.map((h) => (
              <li key={h.id}>
                <span className={`release-tag ${h.action === 'release_live' ? 'live' : 'staging'}`}>{h.action === 'release_live' ? 'Live' : 'Staging'}</span>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ whiteSpace: 'pre-line' }}>{h.reason}</span>
                  <span className="small muted">{when(h.created_at)} · {h.staff_email}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
