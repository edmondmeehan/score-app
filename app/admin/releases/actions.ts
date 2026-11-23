'use server';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { BRANCHES, pending, promote } from '@/lib/github';

/** A short, readable summary of what a move carried, for the History list. */
async function summary(base: string, head: string) {
  const p = await pending(base, head).catch(() => null);
  if (!p || !p.commits.length) return '';
  const short = (t: string) => (t.length > 70 ? t.slice(0, 68) + '…' : t);
  const lines = p.commits.slice(0, 4).map((c) => `• ${short(c.message)}`);
  if (p.count > 4) lines.push(`• …and ${p.count - 4} more`);
  if (p.migrations.length) lines.push(`Database changes: ${p.migrations.map((m) => m.replace('supabase/migrations/', '')).join(', ')}`);
  return ('\n' + lines.join('\n')).slice(0, 420);
}

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
  const what = await summary(BRANCHES.staging, BRANCHES.dev);
  const r = await promote(BRANCHES.dev, BRANCHES.staging);
  await log(supabase, 'release_staging', r.message + (r.sha ? ` (${r.sha.slice(0, 7)})` : '') + (r.ok ? what : ''));
  redirect('/admin/releases?' + (r.ok ? 'ok=' + encodeURIComponent('Moved to Staging. Watch the bar on the Staging card; it’s ready when it says Up to date.') : 'error=' + encodeURIComponent(r.message)));
}

/** Staging → Live. Requires typing LIVE. */
export async function toLive(form: FormData) {
  const supabase = await owner();
  if (String(form.get('confirm') || '').trim().toUpperCase() !== 'LIVE') redirect('/admin/releases?error=' + encodeURIComponent('Type LIVE to confirm.'));
  const what = await summary(BRANCHES.live, BRANCHES.staging);
  const r = await promote(BRANCHES.staging, BRANCHES.live);
  await log(supabase, 'release_live', r.message + (r.sha ? ` (${r.sha.slice(0, 7)})` : '') + (r.ok ? what : ''));
  redirect('/admin/releases?' + (r.ok ? 'ok=' + encodeURIComponent('Going live. Watch the bar on the Live card; members see it when it says Up to date.') : 'error=' + encodeURIComponent(r.message)));
}
