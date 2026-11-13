'use server';
import { clientIp, verifyHuman } from '@/lib/turnstile';
import { cookies } from 'next/headers';
import { supabaseAnon, supabaseServer } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/emails';
import { sendEmail } from '@/lib/mailer';
import { trackEvent } from '@/lib/track';
import { newEventId, recordAttribution, sendMetaLead } from '@/lib/ads';

export type Joined = { eventId: string; code: string; token: string; position: number | null; total: number | null; founder: boolean; founderReason: string | null; referred: boolean };
export type WaitlistState =
  | null
  | { ok: true; message: string; joined?: Joined }
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
  if (!quick && !(await verifyHuman(form, await clientIp(), 'waitlist'))) return { ok: false, message: 'Please confirm you’re not a bot, then try again.' };

  const supabase = await supabaseServer();
  const { data: where } = await supabase.rpc('zip_area', { p_zip: zip });
  const place: string = where?.sub || where?.area || 'your area';
  const open = Boolean(where?.open);

  // Referral: from the form, or the ?ref= link they arrived on (saved as a cookie by middleware).
  const store = await cookies();
  const ref = (String(form.get('ref') || '') || store.get('score_ref')?.value || '').trim().toUpperCase().slice(0, 12) || null;
  const { data, error } = await supabase.rpc('join_waitlist', {
    p_first: first, p_last: String(form.get('last_name') || '').trim(), p_email: email, p_zip: zip,
    p_job: String(form.get('job') || '').trim(), p_ref: ref,
  });
  if (error && /join_waitlist|function .* does not exist|schema cache/i.test(error.message)) {
    // Migration 0016 not run yet: fall back to the original insert so sign-ups never break.
    const { error: e2 } = await supabase.from('waitlist').insert({
      first_name: first || '', last_name: String(form.get('last_name') || '').trim() || null, email, zip,
      job: String(form.get('job') || '').trim() || null, referral_code: ref,
    });
    if (e2 && !e2.message.includes('duplicate')) return { ok: false, message: 'Something went wrong. Try again.' };
    if (e2) return { ok: true, message: `You're already on the waitlist with ${email}. We'll email you when your invite is ready.` };
    await Promise.all([sendEmail(email, 'waitlist_joined', { first_name: first || null, place, open }), trackEvent(quick ? 'waitlist_join_app' : 'waitlist_join')]);
    return { ok: true, message: `You're on the waitlist for ${place}. We sent a confirmation to ${email} and will email you when your invite is ready.` };
  }
  if (error) return { ok: false, message: /zip/i.test(error.message) ? error.message : 'Something went wrong. Try again.' };
  const r = data as { status: 'joined' | 'exists'; resend?: boolean; share_code?: string; status_token?: string; first_name?: string | null; position?: number; total?: number; founder?: boolean; founder_reason?: string | null; referred?: boolean };
  if (r.status === 'exists') {
    // Never show someone else's place in line on screen; email the owner of the address their own link.
    if (r.resend && r.status_token) await sendEmail(email, 'waitlist_joined', { first_name: r.first_name ?? null, place, open, share_url: `${SITE_URL}/w/${r.status_token}`, again: true });
    return { ok: true, message: `You're already on the waitlist. We just emailed ${email} a link to check your spot and share your invite link.` };
  }
  const shareUrl = `${SITE_URL}/w/${r.status_token}`;
  store.delete('score_ref');
  const eventId = newEventId();
  await Promise.all([
    recordAttribution(email),
    sendMetaLead(email, eventId),
    sendEmail(email, 'waitlist_joined', { first_name: first || null, place, open, share_url: shareUrl, position: r.position ?? null, founder: Boolean(r.founder) }),
    trackEvent(quick ? 'waitlist_join_app' : 'waitlist_join'),
    r.referred ? trackEvent('waitlist_join_referred') : Promise.resolve(),
    r.referred ? notifyReferrer(email) : Promise.resolve(),
  ]);
  const joined: Joined = { eventId, code: r.share_code!, token: r.status_token!, position: r.position ?? null, total: r.total ?? null, founder: Boolean(r.founder), founderReason: r.founder_reason ?? null, referred: Boolean(r.referred) };
  return {
    ok: true,
    joined,
    message: open
      ? `You're on the waitlist for ${place}. We sent a confirmation to ${email} and will email you when your invite is ready.`
      : `You're on the waitlist. ScoreDate is opening in ${place} soon, and we'll email ${email} as soon as invites go out in your area.`,
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
  return { ok: true, message: "Thanks. We'll email you when ScoreDate opens near you." };
}

/** A friend joined with someone's link: email them their new spot (and the Founding Member news at 3 friends). */
async function notifyReferrer(newEmail: string) {
  try {
    const { data } = await supabaseAnon().rpc('waitlist_referral_notice', { p_secret: process.env.SCORE_SERVER_SECRET, p_email: newEmail });
    const n = data as { email: string; first_name: string | null; status_token: string; friend: string | null; position: number | null; referrals: number; referrals_needed: number; founder: boolean; unlocked_founder: boolean; spots_per_referral: number } | null;
    if (!n?.email) return;
    await sendEmail(n.email, 'waitlist_referral', {
      first_name: n.first_name, friend: n.friend, position: n.position, referrals: n.referrals, referrals_needed: n.referrals_needed,
      founder: n.founder, unlocked_founder: n.unlocked_founder, spots: n.spots_per_referral, share_url: `${SITE_URL}/w/${n.status_token}`,
    });
  } catch { /* never block a signup on this */ }
}
