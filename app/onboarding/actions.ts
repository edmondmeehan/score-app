'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { personaConfigured, startInquiry } from '@/lib/persona';
import { compareFaces } from '@/lib/facematch';
import { BIOMETRIC_POLICY_VERSION } from '@/lib/policy';
import { sendEmail } from '@/lib/mailer';
import { trackEvent } from '@/lib/track';
import { cookies } from 'next/headers';
import { supabaseAnon } from '@/lib/supabase/server';
import { findUser, pullBand, spinwheelConfigured, startConnect, toE164, verifyCode } from '@/lib/spinwheel';

async function ctx() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');
  return { supabase, user };
}

export async function saveBasics(form: FormData) {
  const { supabase, user } = await ctx();
  const year = Number(form.get('birth_year'));
  const minAge = 25;
  if (!year || new Date().getFullYear() - year < minAge) redirect('/onboarding/basics?error=' + encodeURIComponent('Score members must be 25 or older.'));
  const zip = String(form.get('zip') || '').trim();
  if (!/^[0-9]{5}$/.test(zip)) redirect('/onboarding/basics?error=' + encodeURIComponent('Add your 5-digit home zip code.'));
  const { error } = await supabase.from('profiles').update({
    zip,
    first_name: String(form.get('first_name') || '').trim(),
    birth_year: year,
    gender: String(form.get('gender')),
    seeking: form.getAll('seeking').map(String),
    job: String(form.get('job') || '').trim() || null,
    neighborhood: String(form.get('neighborhood') || '').trim() || null,
  }).eq('id', user.id);
  if (error) redirect('/onboarding/basics?error=' + encodeURIComponent(error.message));
  await trackEvent('onboarding_basics', user.id);
  redirect('/onboarding');
}

export async function startIdentity(form: FormData) {
  const { supabase, user } = await ctx();
  if (form.get('consent') !== 'yes') redirect('/onboarding/identity?error=' + encodeURIComponent('Please agree to the biometric notice to continue.'));
  await supabase.rpc('give_biometric_consent', { p_version: BIOMETRIC_POLICY_VERSION });
  if (!(await personaConfigured())) {
    // Test mode: no real ID check happens.
    const { error } = await supabase.rpc('test_approve_id');
    if (error) redirect('/onboarding/identity?error=' + encodeURIComponent(error.message));
    redirect('/onboarding');
  }
  let inq: { id: string; url: string } | null = null;
  try { inq = await startInquiry(user.id); }
  catch (e) { console.error('[persona] start failed:', (e as Error).message); }
  if (!inq) redirect('/onboarding/identity?error=' + encodeURIComponent('We couldn’t start the ID check right now. Please try again in a few minutes. Our team has been notified.'));
  await supabase.rpc('start_id_verification', { p_provider: 'persona', p_ref: inq.id });
  redirect(inq.url);
}

export async function testSetBand(form: FormData) {
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('test_set_band', { p_band: String(form.get('band')), p_trend: String(form.get('trend') || 'steady') });
  if (error) redirect('/onboarding/credit?error=' + encodeURIComponent(error.message));
  redirect('/onboarding/credit?revealed=1');
}

export async function saveQuiz(form: FormData) {
  const { supabase, user } = await ctx();
  const values = ['style', 'debt', 'check', 'finances', 'goal', 'risk'].map((k) => String(form.get(k) || '')).filter(Boolean);
  if (values.length < 3) redirect('/onboarding/quiz?error=' + encodeURIComponent('Answer at least three.'));
  await supabase.from('profiles').update({
    money_values: values,
    prompt_q: String(form.get('prompt_q') || 'Best purchase I ever made…'),
    prompt_a: String(form.get('prompt_a') || '').trim() || null,
  }).eq('id', user.id);
  redirect('/onboarding');
}

export type PhotoState = { ok: boolean; message: string; results?: { name: string; status: string; similarity: number | null; reason: string }[] } | null;

export async function uploadPhotos(_: PhotoState, form: FormData): Promise<PhotoState> {
  const { supabase, user } = await ctx();
  const selfie = form.get('selfie');
  const photos = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0).slice(0, 6);
  if (!(selfie instanceof File) || selfie.size === 0) return { ok: false, message: 'Take a live selfie first.' };
  if (photos.length === 0) return { ok: false, message: 'Add at least one profile photo.' };
  const { data: consented } = await supabase.from('biometric_consents').select('user_id').eq('user_id', user.id).limit(1);
  if (!consented?.length) return { ok: false, message: 'Biometric consent is required first.' };

  const selfieBytes = new Uint8Array(await selfie.arrayBuffer()); // memory only, never saved
  const { count } = await supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  const room = Math.max(0, 6 - (count || 0));
  if (room === 0) return { ok: false, message: 'You already have 6 photos. Remove one to add another.' };
  const results: NonNullable<PhotoState>['results'] = [];
  const { data: last } = await supabase.from('photos').select('position').eq('user_id', user.id).order('position', { ascending: false }).limit(1);
  let pos = (last?.[0]?.position ?? -1) + 1;
  for (const file of photos.slice(0, room)) {
    if (!file.type.startsWith('image/')) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${user.id}/${crypto.randomUUID()}.${file.type.split('/')[1] || 'jpg'}`;
    const up = await supabase.storage.from('photos').upload(path, bytes, { contentType: file.type });
    if (up.error) { results.push({ name: file.name, status: 'error', similarity: null, reason: up.error.message }); continue; }
    const { data: row } = await supabase.from('photos').insert({ user_id: user.id, path, position: pos++ }).select('id').single();
    const match = await compareFaces(selfieBytes, bytes);
    await supabase.rpc('record_photo_match', { p_secret: process.env.SCORE_SERVER_SECRET, p_photo: row!.id, p_status: match.status, p_similarity: match.similarity });
    results.push({ name: file.name, status: match.status, similarity: match.similarity, reason: match.reason });
  }
  return { ok: true, message: 'Photos checked.', results };
}

export async function choosePlan(form: FormData) {
  const { supabase, user } = await ctx();
  const plan = String(form.get('plan'));
  const { error } = await supabase.rpc('choose_plan', { p_plan: plan });
  if (error) redirect('/plans?error=' + encodeURIComponent(error.message));
  const { data: me } = await supabase.from('profiles').select('email, first_name').eq('id', user.id).single();
  const label: Record<string, string> = { membership: 'Membership', premium: 'Premium', black: 'Reserve', preview: 'Preview', paused: 'Paused' };
  if (['membership', 'premium', 'black'].includes(plan)) {
    await sendEmail(me?.email || user.email, 'welcome_member', { first_name: me?.first_name, plan: label[plan], drop_size: plan === 'membership' ? 5 : 10 });
  }
  await trackEvent('plan_chosen:' + plan, user.id);
  redirect('/app');
}

export async function notifyArea(form: FormData) {
  const { supabase, user } = await ctx();
  const zip = String(form.get('zip') || '').trim();
  if (!/^[0-9]{5}$/.test(zip)) redirect('/onboarding/basics');
  const { data: me } = await supabase.from('profiles').select('email, first_name').eq('id', user.id).single();
  const email = (me?.email || user.email || '').toLowerCase();
  if (email) {
    const { error } = await supabase.from('area_notify').insert({ email, zip, first_name: me?.first_name || null });
    if (!error) await sendEmail(email, 'notify_area', { first_name: me?.first_name, zip });
    await trackEvent('notify_outside_nyc', user.id);
  }
  redirect('/onboarding/not-yet?done=1&zip=' + zip);
}

// ---------- Credit band via Spinwheel ----------
const SW_COOKIE = 'score_sw';
const back = (q: string) => redirect('/onboarding/credit?' + q);

async function finishCredit(userId: string, swUserId: string) {
  let band;
  try { band = await pullBand(swUserId); } catch (e) { back('step=code&error=' + encodeURIComponent((e as Error).message)); return; }
  const { error } = await supabaseAnon().rpc('record_credit_result', { p_secret: process.env.SCORE_SERVER_SECRET, p_user: userId, p_band: band, p_trend: 'steady' });
  (await cookies()).delete(SW_COOKIE);
  if (error) back('error=' + encodeURIComponent(error.message));
  redirect('/onboarding/credit?revealed=1');
}

export async function creditStart(form: FormData) {
  const { user } = await ctx();
  if (!spinwheelConfigured()) back('error=' + encodeURIComponent('The credit partner isn’t set up yet.'));
  if (form.get('consent') !== 'yes') back('error=' + encodeURIComponent('Please agree to the soft credit check to continue.'));
  const phone = toE164(String(form.get('phone') || ''));
  const dob = String(form.get('dob') || '');
  if (!phone) back('error=' + encodeURIComponent('Enter a US mobile number.'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) back('error=' + encodeURIComponent('Enter your date of birth.'));
  let r: { userId: string; connected: boolean };
  try { r = await startConnect(user.id, phone!, dob); } catch (e) { back('error=' + encodeURIComponent((e as Error).message)); return; }
  (await cookies()).set(SW_COOKIE, r.userId, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 15 * 60, path: '/onboarding' });
  if (r.connected) await finishCredit(user.id, r.userId);
  back('step=code');
}

export async function creditVerify(form: FormData) {
  const { user } = await ctx();
  const code = String(form.get('code') || '').replace(/\D/g, '');
  if (code.length !== 6) back('step=code&error=' + encodeURIComponent('Enter the 6-digit code.'));
  // Only trust the Spinwheel user that belongs to this member.
  const swUserId = (await cookies()).get(SW_COOKIE)?.value || (await findUser(user.id));
  const mine = await findUser(user.id);
  if (!swUserId || (mine && mine !== swUserId)) back('error=' + encodeURIComponent('That session expired. Start again.'));
  try { await verifyCode(swUserId!, code); } catch (e) { back('step=code&error=' + encodeURIComponent((e as Error).message)); return; }
  await finishCredit(user.id, swUserId!);
}
