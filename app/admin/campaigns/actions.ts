'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';

const CHANNELS = ['meta', 'google', 'chatgpt', 'youtube', 'creators', 'other'];

export async function addSpend(form: FormData) {
  const { supabase } = await requireStaff();
  const day = String(form.get('day') || '');
  const channel = String(form.get('channel') || '');
  const amount = Number(String(form.get('amount') || '').replace(/[$,]/g, ''));
  const campaign = String(form.get('campaign') || '').trim().slice(0, 120) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !CHANNELS.includes(channel) || !(amount >= 0)) redirect('/admin/campaigns?error=' + encodeURIComponent('Add a date, a channel and an amount.'));
  const { error } = await supabase.from('ad_spend').insert({ day, channel, campaign, amount, note: String(form.get('note') || '').trim().slice(0, 200) || null });
  if (error) redirect('/admin/campaigns?error=' + encodeURIComponent(error.message));
  revalidatePath('/admin/campaigns');
  redirect('/admin/campaigns?ok=Spend+saved');
}

export async function removeSpend(form: FormData) {
  const { supabase } = await requireStaff();
  const id = String(form.get('id') || '');
  const { error } = await supabase.from('ad_spend').delete().eq('id', id);
  if (error) redirect('/admin/campaigns?error=' + encodeURIComponent(error.message));
  revalidatePath('/admin/campaigns');
  redirect('/admin/campaigns?ok=Removed');
}
