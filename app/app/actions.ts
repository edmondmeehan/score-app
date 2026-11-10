'use server';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { flushNotifications } from '@/lib/notify';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/mailer';
import { trackEvent } from '@/lib/track';

async function ctx() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');
  return { supabase, user };
}

export async function sayHello(form: FormData) {
  const { supabase, user } = await ctx();
  const other = String(form.get('id'));
  const { data, error } = await supabase.rpc('start_conversation', { p_other: other });
  if (error) redirect(`/app/u/${other}?error=` + encodeURIComponent(error.message));
  after(() => flushNotifications(user.id));
  redirect(`/app/messages/${data}`);
}

export async function sendMessage(conversationId: string, body: string) {
  const { supabase, user } = await ctx();
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false };
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, body: text });
  if (!error) after(() => flushNotifications(user.id, 20));
  return { ok: !error, error: error?.message };
}

export async function sendPhoto(conversationId: string, path: string) {
  const { supabase, user } = await ctx();
  if (!path.startsWith(`${conversationId}/${user.id}/`)) return { ok: false, error: 'Upload failed' };
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, body: 'Photo', image_path: path });
  if (!error) after(() => flushNotifications(user.id, 20));
  return { ok: !error, error: error?.message };
}

export async function sendVoice(conversationId: string, path: string, seconds: number) {
  const { supabase, user } = await ctx();
  if (!path.startsWith(`${conversationId}/${user.id}/`)) return { ok: false, error: 'Upload failed' };
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, body: 'Voice message', audio_path: path, audio_seconds: Math.max(1, Math.min(120, Math.round(seconds))) });
  if (!error) after(() => flushNotifications(user.id, 20));
  return { ok: !error, error: error?.message };
}

export async function voiceListened(messageId: string) {
  const { supabase } = await ctx();
  await supabase.rpc('mark_voice_listened', { p_message: messageId });
}

export async function answerDeeper(conversationId: string, questionId: number, answer: string) {
  const { supabase, user } = await ctx();
  const { error } = await supabase.rpc('answer_deeper', { p_conversation: conversationId, p_question: questionId, p_answer: answer });
  if (error) return { ok: false, error: error.message, state: null };
  after(() => flushNotifications(user.id, 20));
  const { data } = await supabase.rpc('deeper_state', { p_conversation: conversationId });
  return { ok: true, error: null, state: data };
}

export async function markTogether(form: FormData) {
  const { supabase, user } = await ctx();
  const id = String(form.get('id'));
  const { data, error } = await supabase.rpc('mark_together', { p_conversation: id, p_on: form.get('on') !== 'no' });
  if (error) redirect(`/app/messages/${id}?error=` + encodeURIComponent(error.message));
  if (data === 'mutual') after(() => flushNotifications(user.id, 20));
  redirect(`/app/messages/${id}${data === 'mutual' ? '?together=1' : ''}`);
}

export async function changeEmail(form: FormData) {
  const { supabase, user } = await ctx();
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect('/app/settings?error=' + encodeURIComponent('Enter a valid email address.') + '#email');
  if (email === (user.email || '').toLowerCase()) redirect('/app/settings?error=' + encodeURIComponent('That’s already your email.') + '#email');
  const { error } = await supabase.auth.updateUser({ email });
  if (error) redirect('/app/settings?error=' + encodeURIComponent(/registered|exists/i.test(error.message) ? 'That email is already used by another account.' : error.message) + '#email');
  redirect('/app/settings?saved=email_sent#email');
}

export async function setFocusMode(form: FormData) {
  const { supabase, user } = await ctx();
  const { error } = await supabase.from('profiles').update({ focus_mode: form.get('focus') === 'on' }).eq('id', user.id);
  redirect('/app/settings?' + (error ? 'error=' + encodeURIComponent(error.message) : 'saved=1#focus'));
}

export async function setAiIdeas(form: FormData) {
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('set_ai_ideas', { p_on: form.get('ai') === 'on' });
  redirect('/app/settings?' + (error ? 'error=' + encodeURIComponent(error.message) : 'saved=1#ai'));
}

export async function saveWellbeing(form: FormData) {
  const { supabase } = await ctx();
  const score = Number(form.get('score'));
  await supabase.rpc('save_wellbeing', { p_score: score });
  redirect('/app?ok=' + encodeURIComponent(score <= 2 ? 'Thanks for telling us. Dating can be a lot. Taking a break is always allowed.' : 'Thanks. That helps us make ScoreDate better.'));
}

export async function unmatchConversation(form: FormData) {
  const { supabase } = await ctx();
  const id = String(form.get('id'));
  const { error } = await supabase.rpc('unmatch', { p_conversation: id });
  if (error) redirect(`/app/messages/${id}?error=` + encodeURIComponent(error.message));
  revalidatePath('/app/messages');
  redirect('/app/messages?ok=' + encodeURIComponent('Unmatched. You won’t see each other in Messages anymore.'));
}

export async function kindClose(conversationId: string, choice: number) {
  const { supabase, user } = await ctx();
  const { error } = await supabase.rpc('kind_close', { p_conversation: conversationId, p_choice: choice });
  if (error) return { ok: false, error: error.message };
  after(() => flushNotifications(user.id, 20));
  revalidatePath('/app/messages');
  return { ok: true };
}

export async function otherReadAt(conversationId: string) {
  const { supabase } = await ctx();
  const { data } = await supabase.rpc('other_read_at', { p_conversation: conversationId });
  return (data as string | null) || null;
}

export async function makeInvite(form: FormData) {
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('create_invite', { p_kind: String(form.get('kind') || 'date') });
  if (error) redirect('/app/invites?error=' + encodeURIComponent(error.message));
  revalidatePath('/app/invites');
  redirect('/app/invites');
}

export async function submitReport(form: FormData) {
  const { supabase, user } = await ctx();
  const reported = String(form.get('id'));
  await supabase.from('reports').insert({ reporter_id: user.id, reported_id: reported, reason: String(form.get('reason')), note: String(form.get('note') || '').slice(0, 2000) || null });
  if (form.get('block') === 'yes') await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: reported });
  const { data: me } = await supabase.from('profiles').select('email, first_name').eq('id', user.id).single();
  await sendEmail(me?.email || user.email, 'report_received', { first_name: me?.first_name });
  redirect('/app/messages?reported=1');
}

export async function setStatus(form: FormData) {
  const { supabase, user } = await ctx();
  const s = String(form.get('status'));
  const plan = s === 'active' ? String(form.get('plan') || 'membership') : s;
  const { error } = await supabase.rpc('choose_plan', { p_plan: plan });
  if (error) redirect('/app/settings?error=' + encodeURIComponent(error.message));
  if (s === 'paused' || s === 'taken' || s === 'active') {
    const { data: me } = await supabase.from('profiles').select('email, first_name').eq('id', user.id).single();
    await sendEmail(me?.email || user.email, 'status_changed', { first_name: me?.first_name, status: s });
  }
  redirect('/app/settings?saved=1');
}

export async function saveProfile(form: FormData) {
  const { supabase, user } = await ctx();
  await supabase.from('profiles').update({
    job: String(form.get('job') || '').trim() || null,
    prompt_q: String(form.get('prompt_q') || ''),
    prompt_a: String(form.get('prompt_a') || '').trim() || null,
  }).eq('id', user.id);
  redirect('/app/settings?saved=1');
}

export async function deleteAccount(form: FormData) {
  const { supabase, user } = await ctx();
  if (form.get('confirm') !== 'DELETE') redirect('/app/settings?error=' + encodeURIComponent('Type DELETE to confirm.'));
  const { data: me } = await supabase.from('profiles').select('email, first_name').eq('id', user.id).single();
  const { error } = await supabase.rpc('request_deletion');
  if (error) redirect('/app/settings?error=' + encodeURIComponent(error.message));
  await sendEmail(me?.email || user.email, 'deletion_confirm', { first_name: me?.first_name });
  await supabase.auth.signOut();
  redirect(/ScoreDateApp/.test((await headers()).get('user-agent') || '') ? '/join?deleted=1' : '/?deleted=1');
}

/** Reply to one of a member's prompts: opens (or reuses) the conversation and sends the reply quoting the prompt. */
export async function replyToPrompt(form: FormData) {
  const { supabase, user } = await ctx();
  const other = String(form.get('id'));
  const prompt = String(form.get('prompt') || '').slice(0, 300);
  const body = String(form.get('body') || '').trim().slice(0, 1000);
  if (!body) redirect(`/app/u/${other}?error=` + encodeURIComponent('Write a reply first.'));
  const { data: cid, error } = await supabase.rpc('start_conversation', { p_other: other });
  if (error || !cid) redirect(`/app/u/${other}?error=` + encodeURIComponent(error?.message === 'upgrade to connect' ? 'Become a member to reply to prompts.' : error?.message || 'Couldn’t send that.'));
  const { error: e2 } = await supabase.from('messages').insert({ conversation_id: cid, sender_id: user.id, body: `↩ “${prompt}”\n\n${body}` });
  if (e2) redirect(`/app/u/${other}?error=` + encodeURIComponent(e2.message));
  after(() => flushNotifications(user.id, 20));
  redirect(`/app/messages/${cid}`);
}

/** Come back from Paused / Taken. */
export async function reactivate(form: FormData) {
  const { supabase, user } = await ctx();
  const plan = ['membership', 'premium', 'black'].includes(String(form.get('plan'))) ? String(form.get('plan')) : 'membership';
  const { error } = await supabase.rpc('choose_plan', { p_plan: plan });
  if (error) redirect('/app/paused?error=' + encodeURIComponent(error.message));
  const { data: me } = await supabase.from('profiles').select('email, first_name').eq('id', user.id).single();
  await sendEmail(me?.email || user.email, 'status_changed', { first_name: me?.first_name, status: 'active' });
  revalidatePath('/app', 'layout');
  redirect('/app');
}

// ---------- Traveling and visiting ----------
export async function setTraveling(form: FormData) {
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('set_traveling', {
    p_until: String(form.get('until') || '') || null, p_where: String(form.get('where') || ''), p_pause: form.get('pause') === 'on',
  });
  revalidatePath('/app', 'layout');
  redirect('/app/settings?' + (error ? 'error=' + encodeURIComponent(error.message) : 'saved=1') + '#travel');
}

export async function endTraveling(form: FormData) {
  const { supabase } = await ctx();
  await supabase.rpc('end_traveling');
  revalidatePath('/app', 'layout');
  redirect(String(form.get('back') || '') === 'app' ? '/app?ok=' + encodeURIComponent('Welcome back.') : '/app/settings?saved=1#travel');
}

export async function setVisit(form: FormData) {
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('set_visit', { p_until: String(form.get('until') || '') || null });
  revalidatePath('/app', 'layout');
  const to = String(form.get('back') || '') === 'app' ? '/app' : '/app/settings';
  redirect(to + '?' + (error ? 'error=' + encodeURIComponent(error.message) : 'ok=' + encodeURIComponent('Visiting is on. Your Drops start tonight.')) + (to === '/app/settings' ? '#travel' : ''));
}

export async function endVisit() {
  const { supabase } = await ctx();
  await supabase.rpc('end_visit');
  revalidatePath('/app', 'layout');
  redirect('/app/settings?saved=1#travel');
}

// ---------- Credit band ----------
/** "Still the same": re-confirm the current self-reported band (resets the monthly reminder). */
export async function confirmBand() {
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('confirm_band');
  redirect('/app/settings?' + (error ? 'error=' + encodeURIComponent(error.message) : 'saved=band') + '#band');
}
