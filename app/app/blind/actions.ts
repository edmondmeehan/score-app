'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

const back = (path: string, msg: string) => redirect(`${path}?error=${encodeURIComponent(msg)}`);

export async function saveBlindAnswers(form: FormData) {
  const supabase = await supabaseServer();
  const p = Object.fromEntries(['q1', 'q2', 'q3', 'q4', 'q5'].map((k) => [k, String(form.get(k) || '')]));
  const { error } = await supabase.rpc('save_compat_answers', { p });
  if (error) back('/app/blind', error.message);
  revalidatePath('/app/blind');
  redirect(form.get('then') === 'play' ? '/app/blind?play=1' : '/app/blind?saved=1');
}

export async function newBlindRound() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('blind_next');
  if (error) back('/app/blind', error.message);
  if (!data) back('/app/blind', 'No new matches to play right now. Check back tomorrow.');
  redirect(`/app/blind/${data}`);
}

export async function revealBlind(form: FormData) {
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  await supabase.rpc('blind_reveal', { p_id: id });
  redirect(`/app/blind/${id}?revealed=1`);
}

export async function chooseBlind(form: FormData) {
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  const { data, error } = await supabase.rpc('blind_choose', { p_id: id, p_choice: String(form.get('choice')) });
  if (error) back(`/app/blind/${id}`, error.message === 'upgrade to connect' ? 'Become a member to connect.' : error.message);
  revalidatePath('/app/blind');
  redirect(`/app/blind/${id}${(data as { matched?: boolean })?.matched ? '?matched=1' : ''}`);
}
