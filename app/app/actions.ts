'use server';
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

export async function unmatchConversation(form: FormData) {
  const { supabase } = await ctx();
  const id = String(form.get('id'));
  const { error } = await supabase.rpc('unmatch', { p_conversation: id });
  if (error) redirect(`/app/messages/${id}?error=` + encodeURIComponent(error.message));
  revalidatePath('/app/messages');
  redirect('/app/messages?ok=' + encodeURIComponent('Unmatched. You won’t see each other in Messages anymore.'));
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
    neighborhood: String(form.get('neighborhood') || '').trim() || null,
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
  redirect('/?deleted=1');
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
