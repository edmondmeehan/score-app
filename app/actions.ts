'use server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/mailer';
import { trackEvent } from '@/lib/track';

export type WaitlistState =
  | null
  | { ok: true; message: string }
  | { ok: false; message: string; outside?: { first_name: string; email: string; zip: string } };

const EMAIL = /^\S+@\S+\.\S+$/;

export async function joinWaitlist(_: WaitlistState, form: FormData): Promise<WaitlistState> {
  const quick = form.get('quick') === '1'; // in-app "no invite code" form: email + zip only
  const first = String(form.get('first_name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const zip = String(form.get('zip') || '').trim();
  if (!EMAIL.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  if (!quick && !first) return { ok: false, message: 'Add your first name and a valid email.' };
  if (!/^[0-9]{5}$/.test(zip)) return { ok: false, message: 'Add your 5-digit zip code.' };

  const supabase = await supabaseServer();
  const { data: where } = await supabase.rpc('zip_area', { p_zip: zip });
  const place: string = where?.sub || where?.area || 'your area';
  const open = Boolean(where?.open);

  const { error } = await supabase.from('waitlist').insert({
    first_name: first || '',
    last_name: String(form.get('last_name') || '').trim() || null,
    email,
    zip,
    job: String(form.get('job') || '').trim() || null,
    referral_code: String(form.get('ref') || '').trim() || null,
  });
  if (error && !error.message.includes('duplicate')) return { ok: false, message: 'Something went wrong. Try again.' };
  if (error) return { ok: true, message: `You're already on the waitlist with ${email}. We'll email you when your invite is ready.` };
  await Promise.all([sendEmail(email, 'waitlist_joined', { first_name: first || null, place, open }), trackEvent(quick ? 'waitlist_join_app' : 'waitlist_join')]);
  return {
    ok: true,
    message: open
      ? `You're on the waitlist for ${place}. We sent a confirmation to ${email} and will email you when your invite is ready.`
      : `You're on the waitlist. Score is opening in ${place} soon, and we'll email ${email} as soon as invites go out in your area.`,
  };
}

export async function notifyMe(_: unknown, form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const zip = String(form.get('zip') || '').trim();
  if (!EMAIL.test(email) || !/^[0-9]{5}$/.test(zip)) return { ok: false, message: 'Something went wrong. Try again.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('area_notify').insert({
    email,
    zip,
    first_name: String(form.get('first_name') || '').trim() || null,
  });
  if (error && !error.message.includes('duplicate')) return { ok: false, message: 'Something went wrong. Try again.' };
  if (!error) await Promise.all([sendEmail(email, 'notify_area', { first_name: String(form.get('first_name') || '') || null, zip }), trackEvent('notify_outside_nyc')]);
  return { ok: true, message: "Thanks. We'll email you when Score opens near you." };
}
