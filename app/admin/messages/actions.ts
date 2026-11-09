'use server';
import { after } from 'next/server';
import { requireStaff } from '@/lib/session';
import { flushNotifications } from '@/lib/notify';

export type Filters = Record<string, string | string[] | boolean | number | undefined>;
export type Draft = { id?: string; title: string; body: string; url: string; channels: string[]; filters: Filters; scheduled_at?: string };
export type Preview = { count: number; capped: number; sample: string[] };

const clean = (f: Filters) => Object.fromEntries(Object.entries(f).filter(([, v]) => !(v === '' || v === undefined || v === false || (Array.isArray(v) && v.length === 0))));
const hint = (m: string) => (/does not exist|schema cache/i.test(m) ? 'Run migration 0053 in the SQL Editor first.' : m);

export async function previewAudience(filters: Filters): Promise<Preview | { error: string }> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc('staff_campaign_preview', { f: clean(filters) });
  return error ? { error: hint(error.message) } : (data as Preview);
}

async function save(d: Draft) {
  const { supabase } = await requireStaff();
  if (!d.title.trim() || !d.body.trim()) throw new Error('Add a title and a message.');
  if (!d.channels.length) throw new Error('Pick at least one way to send it.');
  const { data, error } = await supabase.rpc('staff_save_member_campaign', { p: { ...d, filters: clean(d.filters), url: d.url.startsWith('/') ? d.url : '/app' } });
  if (error) throw new Error(hint(error.message));
  return { supabase, id: data as string };
}

export async function saveCampaign(d: Draft): Promise<{ id?: string; ok?: string; error?: string }> {
  try {
    const { id } = await save(d);
    return { id, ok: d.scheduled_at ? 'Scheduled. It sends automatically at that time.' : 'Saved as a draft.' };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function sendCampaign(d: Draft, test: boolean): Promise<{ id?: string; ok?: string; error?: string }> {
  try {
    const { supabase, id } = await save({ ...d, scheduled_at: '' });
    const { data, error } = await supabase.rpc('staff_send_member_campaign', { p_id: id, p_test: test });
    if (error) return { id, error: hint(error.message) };
    after(() => flushNotifications(null, 1000));
    const n = (data as { sent: number }).sent;
    return { id, ok: test ? 'Test sent to you. Check Activity in the app (and your phone if push is on).' : `Sent to ${n} member${n === 1 ? '' : 's'}.` };
  } catch (e) { return { error: (e as Error).message }; }
}
