import 'server-only';

/** The code repo and its three branches: dev → staging → main (live). */
export const REPO = 'edmondmeehan/score-app';
export const BRANCHES = { dev: 'dev', staging: 'staging', live: 'main' } as const;
export type Stage = keyof typeof BRANCHES;

const token = () => process.env.GITHUB_TOKEN;
export const githubReady = () => Boolean(token());

async function gh<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null; message?: string }> {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  return { ok: res.ok, status: res.status, data, message: data?.message };
}

export type BranchInfo = { name: string; sha: string; message: string; date: string; author: string } | null;
export async function branchInfo(branch: string): Promise<BranchInfo> {
  const r = await gh<{ commit: { sha: string; commit: { message: string; author: { name: string; date: string } } } }>(`/branches/${branch}`);
  if (!r.ok || !r.data) return null;
  const c = r.data.commit;
  return { name: branch, sha: c.sha, message: c.commit.message.split('\n')[0], date: c.commit.author.date, author: c.commit.author.name };
}

/** Commits that are on `head` but not yet on `base` (newest first). */
export async function pending(base: string, head: string): Promise<{ count: number; behind: number; commits: { sha: string; message: string; date: string }[] } | null> {
  const r = await gh<{ ahead_by: number; behind_by: number; commits: { sha: string; commit: { message: string; author: { date: string } } }[] }>(`/compare/${base}...${head}`);
  if (!r.ok || !r.data) return null;
  return {
    count: r.data.ahead_by, behind: r.data.behind_by,
    commits: r.data.commits.slice(-15).reverse().map((c) => ({ sha: c.sha, message: c.commit.message.split('\n')[0], date: c.commit.author.date })),
  };
}

/**
 * Move `to` up to exactly what `from` has. Fast-forward only: if `to` has changes `from` doesn't, nothing moves.
 * Creates the branch the first time (e.g. staging). Vercel deploys the branch automatically after it moves.
 */
export async function promote(from: string, to: string): Promise<{ ok: boolean; message: string; sha?: string }> {
  const src = await branchInfo(from);
  if (!src) return { ok: false, message: `Couldn't read the ${from} branch on GitHub.` };
  const exists = await gh(`/git/ref/heads/${to}`);
  if (exists.status === 404) {
    const c = await gh(`/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${to}`, sha: src.sha }) });
    return c.ok ? { ok: true, message: `Created ${to} from ${from}.`, sha: src.sha } : { ok: false, message: c.message || `GitHub error ${c.status}` };
  }
  const r = await gh(`/git/refs/heads/${to}`, { method: 'PATCH', body: JSON.stringify({ sha: src.sha, force: false }) });
  if (r.ok) return { ok: true, message: `${to} now matches ${from}.`, sha: src.sha };
  if (r.status === 422) return { ok: false, message: `${to} has changes that aren't on ${from}, so nothing was moved. Ask for help merging them first.` };
  if (r.status === 403 || r.status === 401) return { ok: false, message: 'The GitHub token in Vercel can’t change branches. It needs “Contents: Read and write” on the score-app repo.' };
  return { ok: false, message: r.message || `GitHub error ${r.status}` };
}
