'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';
import { sendEmail } from '@/lib/mailer';
import { reportBlocks } from '@/lib/adminReport';

const err = (m: string) => (/Could not find the function/i.test(m) ? 'Run migration 0024 in the ScoreDate SQL Editor first.' : m);

export async function saveReportPrefs(form: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('set_my_report_prefs', { p_daily: form.get('daily') === 'on', p_sections: form.getAll('sections').map(String) });
  if (error) redirect('/admin/reports?error=' + encodeURIComponent(err(error.message)));
  revalidatePath('/admin/reports');
  redirect('/admin/reports?ok=' + encodeURIComponent(form.get('daily') === 'on' ? 'Saved. Your report arrives every morning around 11am ET.' : 'Saved. Daily report is off.'));
}

export async function sendTestReport(form: FormData) {
  const { supabase, staffEmail } = await requireStaff();
  const sections = form.getAll('sections').map(String);
  const { data, error } = await supabase.rpc('staff_daily_report');
  if (error) redirect('/admin/reports?error=' + encodeURIComponent(err(error.message)));
  const date = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
  const r = await sendEmail(staffEmail, 'admin_daily', { date, ...reportBlocks(data as never, sections.length ? sections : ['finance', 'members', 'waitlist', 'engagement', 'safety']) });
  redirect('/admin/reports?' + (r.ok ? 'ok=' + encodeURIComponent(`Test report sent to ${staffEmail}.`) : 'error=' + encodeURIComponent(`Couldn’t send: ${r.error}`)));
}
