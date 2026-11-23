import 'server-only';

// Latest Vercel build for each branch, so Releases can show whether a site has actually updated. Needs VERCEL_API_TOKEN.
const TEAM = process.env.VERCEL_TEAM_ID || 'team_NgoNLTCpkZJtMvofpxa0DBqB';
const PROJECT = process.env.SCORE_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID || 'prj_MKOzvdqJYuJiHTgqBGhUwpgfJGAc';

export type Build = { state: 'READY' | 'BUILDING' | 'QUEUED' | 'INITIALIZING' | 'ERROR' | 'CANCELED' | string; sha: string; created: number; url: string } | null;

export async function latestBuild(branch: string, production = false): Promise<Build> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return null;
  const q = new URLSearchParams({ projectId: PROJECT, teamId: TEAM, limit: '1', ...(production ? { target: 'production' } : { branch }) });
  try {
    const res = await fetch(`https://api.vercel.com/v6/deployments?${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const d = (await res.json())?.deployments?.[0];
    if (!d) return null;
    return { state: d.state || d.readyState, sha: d.meta?.githubCommitSha || '', created: d.created, url: `https://vercel.com/pleaseco/score-app/${String(d.uid || '').replace(/^dpl_/, '')}` };
  } catch { return null; }
}

/** Ask Vercel to build a branch (used when a move didn't start a build on its own). */
export async function rebuild(branch: string): Promise<{ ok: boolean; message: string }> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return { ok: false, message: 'VERCEL_API_TOKEN isn’t set.' };
  try {
    const res = await fetch(`https://api.vercel.com/v13/deployments?teamId=${TEAM}`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'score-app', project: PROJECT, target: branch === 'main' ? 'production' : undefined, gitSource: { type: 'github', org: 'edmondmeehan', repo: 'score-app', ref: branch } }),
    });
    if (res.ok) return { ok: true, message: 'Build started.' };
    const b = await res.json().catch(() => null);
    return { ok: false, message: b?.error?.message || `Vercel error ${res.status}` };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
