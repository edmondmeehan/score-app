'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';

const nyToIso = (local: string) => {
  // datetime-local is entered in New York time; convert to an ISO instant.
  if (!local) return '';
  const guess = new Date(local + 'Z');
  const ny = new Date(guess.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() + (utc.getTime() - ny.getTime())).toISOString();
};

export async function saveGiveaway(form: FormData) {
  const { supabase } = await requireStaff();
  const id = String(form.get('id') || '');
  const v = (k: string) => String(form.get(k) ?? '').trim();
  const back = id ? `/admin/giveaways/${id}` : '/admin/giveaways/new';
  const p = {
    id, title: v('title'), prize: v('prize'), prize_value_usd: Number(v('prize_value_usd') || 0), winners_count: Number(v('winners_count') || 1),
    description: v('description'), image_url: v('image_url'), partner: v('partner'), eligibility: v('eligibility'),
    starts_at: nyToIso(v('starts_at')), ends_at: nyToIso(v('ends_at')), status: v('status') || 'draft', extra_rules: v('extra_rules'),
  };
  if (!p.title || !p.prize || !p.starts_at || !p.ends_at) redirect(back + '?error=' + encodeURIComponent('Title, prize and dates are required.'));
  if (p.image_url && !p.image_url.startsWith('https://')) redirect(back + '?error=' + encodeURIComponent('Image link must start with https://'));
  const { data, error } = await supabase.rpc('staff_save_giveaway', { p });
  if (error) redirect(back + '?error=' + encodeURIComponent(/does not exist|schema cache/i.test(error.message) ? 'Run migration 0050 in the SQL Editor first.' : error.message));
  revalidatePath('/giveaways'); revalidatePath('/app/discover');
  redirect(`/admin/giveaways/${data}?ok=` + encodeURIComponent('Saved.'));
}

export async function drawWinners(form: FormData) {
  const { supabase } = await requireStaff();
  const id = String(form.get('id'));
  const { data, error } = await supabase.rpc('staff_draw_giveaway', { p_g: id });
  if (error) redirect(`/admin/giveaways/${id}?error=` + encodeURIComponent(error.message));
  revalidatePath('/giveaways');
  redirect(`/admin/giveaways/${id}?ok=` + encodeURIComponent(`Drew ${(data as { picked: number }).picked} winner(s). Email them from the list below.`));
}

export async function setWinner(form: FormData) {
  const { supabase } = await requireStaff();
  const id = String(form.get('id'));
  const { error } = await supabase.rpc('staff_giveaway_winner', { p_winner: Number(form.get('winner')), p_status: String(form.get('status')) });
  redirect(`/admin/giveaways/${id}?` + (error ? 'error=' + encodeURIComponent(error.message) : 'ok=Updated'));
}
