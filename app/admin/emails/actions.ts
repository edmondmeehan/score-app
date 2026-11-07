'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/mailer';
import { SAMPLES, TEMPLATE_INFO, type TemplateName } from '@/lib/emails';

export async function sendTestEmail(form: FormData) {
  const supabase = await supabaseServer();
  const { data: isStaff } = await supabase.rpc('is_staff');
  const { data: email } = await supabase.rpc('staff_email');
  if (!isStaff || !email) redirect('/admin');
  const name = String(form.get('template')) as TemplateName;
  if (!(name in TEMPLATE_INFO)) redirect('/admin/emails?error=unknown');
  const r = await sendEmail(String(email), name, SAMPLES[name] as never);
  redirect(`/admin/emails?t=${name}&` + (r.ok ? `sent=${encodeURIComponent(String(email))}` : `error=${encodeURIComponent(r.error || 'failed')}`));
}
