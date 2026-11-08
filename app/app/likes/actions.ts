'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { flushNotifications } from '@/lib/notify';

export async function likeMember(form: FormData) {
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  const back = String(form.get('back') || `/app/u/${id}`);
  const { data, error } = await supabase.rpc('like_member', { p_other: id });
  if (error) redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(error.message)}`);
  const { data: { user } } = await supabase.auth.getUser();
  after(() => flushNotifications(user?.id ?? null, 10));
  const r = data as { mutual: boolean; conversation_id: string | null };
  revalidatePath('/app/likes');
  if (r?.mutual && r.conversation_id) redirect(`/app/messages/${r.conversation_id}?ok=${encodeURIComponent('It’s a match. You both liked each other.')}&match=1`);
  redirect(`${back}${back.includes('?') ? '&' : '?'}liked=1`);
}

export async function unlikeMember(form: FormData) {
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  await supabase.rpc('unlike_member', { p_other: id });
  redirect(String(form.get('back') || `/app/u/${id}`));
}
