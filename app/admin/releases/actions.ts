'use server';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { BRANCHES, promote } from '@/lib/github';

async function owner() {
  const { supabase } = await requireStaff();
  const { data: role } = await supabase.rpc('staff_role');
  if (role !== 'owner') redirect('/admin/releases?error=' + encodeURIComponent('Only owners can move releases.'));
  return supabase;
}

async function log(supabase: Awaited<ReturnType<typeof owner>>, action: string, reason: string) {
  await supabase.rpc('staff_log', { p_action: action, p_reason: reason }).then(() => null, () => null);
}

/** Dev → Staging. */
export async function toStaging() {
  const supabase = await owner();
  const r = await promote(BRANCHES.dev, BRANCHES.staging);
  await log(supabase, 'release_staging', r.message + (r.sha ? ` (${r.sha.slice(0, 7)})` : ''));
  redirect('/admin/releases?' + (r.ok ? 'ok=' + encodeURIComponent('Staging is updating. It’s ready in about 2 minutes at staging.scoredate.app.') : 'error=' + encodeURIComponent(r.message)));
}

/** Staging → Live. Requires typing LIVE. */
export async function toLive(form: FormData) {
  const supabase = await owner();
  if (String(form.get('confirm') || '').trim().toUpperCase() !== 'LIVE') redirect('/admin/releases?error=' + encodeURIComponent('Type LIVE to confirm.'));
  const r = await promote(BRANCHES.staging, BRANCHES.live);
  await log(supabase, 'release_live', r.message + (r.sha ? ` (${r.sha.slice(0, 7)})` : ''));
  redirect('/admin/releases?' + (r.ok ? 'ok=' + encodeURIComponent('Going live. www.scoredate.app updates in about 2 minutes.') : 'error=' + encodeURIComponent(r.message)));
}
