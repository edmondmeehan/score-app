import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { BRANCHES, branchInfo } from '@/lib/github';
import { latestBuild, rebuild } from '@/lib/vercelDeploys';

export const dynamic = 'force-dynamic';
const BRANCH = { dev: BRANCHES.dev, staging: BRANCHES.staging, live: BRANCHES.live } as const;
type Site = keyof typeof BRANCH;

/** Staff only: where a site's branch is and how its latest build is doing (polled by the Releases progress bars). */
export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: isStaff } = await supabase.rpc('is_staff');
  if (!isStaff) return NextResponse.json({ error: 'staff only' }, { status: 403 });
  const site = new URL(req.url).searchParams.get('site') as Site;
  if (!BRANCH[site]) return NextResponse.json({ error: 'unknown site' }, { status: 400 });
  const [info, build] = await Promise.all([branchInfo(BRANCH[site]), latestBuild(BRANCH[site], site === 'live')]);
  return NextResponse.json({ sha: info?.sha || null, build }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Owners: start a build for a site whose move didn't trigger one. */
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: role } = await supabase.rpc('staff_role');
  if (role !== 'owner') return NextResponse.json({ error: 'owner only' }, { status: 403 });
  const site = new URL(req.url).searchParams.get('site') as Site;
  if (!BRANCH[site]) return NextResponse.json({ error: 'unknown site' }, { status: 400 });
  const r = await rebuild(BRANCH[site]);
  await supabase.rpc('staff_log', { p_action: 'release_rebuild', p_reason: `${site}: ${r.message}` }).then(() => null, () => null);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
