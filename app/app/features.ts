'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { trackEvent } from '@/lib/track';

async function ctx() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');
  return { supabase, user };
}

const back = (path: string, key: 'error' | 'ok', msg: string) => redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
const safe = (p: FormDataEntryValue | null, fallback: string) => {
  const s = String(p || '');
  return s.startsWith('/app') ? s : fallback;
};
const friendly = (m: string) => m.replace(/^no (extra drop|spotlight|note) left$/, (_, k) => `You don't have any ${k === 'extra drop' ? 'Extra connections' : k === 'spotlight' ? 'Spotlights' : 'Notes'} left. Get more in the shop.`);

// ---------- Add-ons ----------
export async function buyAddon(form: FormData) {
  const { supabase, user } = await ctx();
  const sku = String(form.get('sku'));
  const ret = safe(form.get('return'), '/app/shop');
  const { error } = await supabase.rpc('buy_addon', { p_sku: sku });
  if (error) back(ret, 'error', error.message);
  await trackEvent('addon_buy:' + sku, user.id);
  back(ret, 'ok', 'Added to your account.');
}

export async function useExtraDrop(form: FormData) {
  const { supabase, user } = await ctx();
  const ret = safe(form.get('return'), '/app');
  const { data, error } = await supabase.rpc('use_extra_drop');
  if (error) back(ret, 'error', friendly(error.message));
  await trackEvent('addon_use:extra_drop', user.id);
  back(ret, 'ok', `${data} more ${data === 1 ? 'person' : 'people'} added to today's Drop.`);
}

export async function useSpotlight(form: FormData) {
  const { supabase, user } = await ctx();
  const ret = safe(form.get('return'), '/app');
  const { error } = await supabase.rpc('use_spotlight');
  if (error) back(ret, 'error', friendly(error.message));
  await trackEvent('addon_use:spotlight', user.id);
  back(ret, 'ok', 'Spotlight is on for the next hour.');
}

export async function sendNote(form: FormData) {
  const { supabase, user } = await ctx();
  const other = String(form.get('id'));
  const { data, error } = await supabase.rpc('send_note', { p_other: other, p_body: String(form.get('body') || '') });
  if (error) back(`/app/u/${other}`, 'error', friendly(error.message));
  await trackEvent('addon_use:note', user.id);
  redirect(`/app/messages/${data}`);
}

// ---------- Email preferences ----------
export async function saveEmailPrefs(form: FormData) {
  const { supabase, user } = await ctx();
  const on = (k: string) => form.get(k) === 'on';
  const { error } = await supabase.from('email_prefs').upsert({
    user_id: user.id, daily_drop: on('daily_drop'), messages: on('messages'), events: on('events'), reminders: on('reminders'), updated_at: new Date().toISOString(),
  });
  if (error) back('/app/settings', 'error', error.message);
  redirect('/app/settings?saved=email#email');
}

// ---------- Dates ----------
export async function proposeDate(form: FormData) {
  const { supabase } = await ctx();
  const conv = String(form.get('conversation_id'));
  const when = String(form.get('starts_at') || '');      // "YYYY-MM-DDTHH:mm" in the member's local time
  const tz = Number(form.get('tz_offset') || 0);         // minutes, from the browser (Date#getTimezoneOffset)
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when) ? when : '';
  if (!local) back(`/app/messages/${conv}`, 'error', 'Pick a day and time.');
  const utc = new Date(Date.parse(local + ':00Z') + tz * 60000).toISOString();
  const { error } = await supabase.rpc('propose_date', {
    p_conversation: conv, p_place: String(form.get('place') || ''), p_address: String(form.get('address') || ''),
    p_starts_at: utc, p_note: String(form.get('note') || ''),
  });
  if (error) back(`/app/messages/${conv}`, 'error', error.message);
  redirect(`/app/messages/${conv}`);
}

export async function respondDate(form: FormData) {
  const { supabase } = await ctx();
  const conv = String(form.get('conversation_id'));
  const { error } = await supabase.rpc('respond_date', { p_plan: String(form.get('plan_id')), p_status: String(form.get('status')) });
  if (error) back(`/app/messages/${conv}`, 'error', error.message);
  redirect(`/app/messages/${conv}`);
}

export async function shareDate(form: FormData) {
  const { supabase } = await ctx();
  const conv = String(form.get('conversation_id'));
  const { error } = await supabase.rpc('share_date', { p_plan: String(form.get('plan_id')), p_friend: String(form.get('friend') || '') });
  if (error) back(`/app/messages/${conv}`, 'error', error.message);
  redirect(`/app/messages/${conv}?shared=1`);
}

export async function revokeShare(form: FormData) {
  const { supabase } = await ctx();
  const conv = String(form.get('conversation_id'));
  await supabase.rpc('revoke_date_share', { p_plan: String(form.get('plan_id')) });
  redirect(`/app/messages/${conv}`);
}

export async function checkIn(form: FormData) {
  const { supabase } = await ctx();
  const status = String(form.get('status'));
  const plan = String(form.get('plan_id'));
  const { error } = await supabase.rpc('date_checkin', { p_plan: plan, p_status: status });
  if (error) back('/app', 'error', error.message);
  if (status === 'report') redirect(`/app/report/${String(form.get('other_id'))}`);
  back('/app', 'ok', status === 'safe' ? 'Glad it went well. Thanks for checking in.' : 'Thanks for telling us. You can report or block them any time from their profile.');
}

// ---------- Events ----------
export async function rsvp(form: FormData) {
  const { supabase, user } = await ctx();
  const id = String(form.get('event_id'));
  const going = form.get('going') === 'yes';
  const { data, error } = await supabase.rpc('rsvp_event', { p_event: id, p_going: going });
  if (error) back(`/app/events/${id}`, 'error', error.message);
  await trackEvent('event_rsvp:' + data, user.id);
  revalidatePath('/app/events');
  back(`/app/events/${id}`, 'ok', data === 'going' ? "You're on the list. See you there." : data === 'waitlist' ? "It's full, so you're on the waitlist. We'll move you in if a spot opens." : 'Your RSVP is cancelled.');
}
