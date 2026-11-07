'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer, supabaseAnon } from '@/lib/supabase/server';
import { sendBatch } from '@/lib/mailer';
import { unsubUrl } from '@/lib/unsub';
import { when } from '@/lib/events';

/** "2026-12-04T19:30" typed in New York time → ISO in UTC (handles daylight saving). */
function nyToIso(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return '';
  const guess = new Date(local + ':00Z');
  const ny = new Date(guess.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() + (utc.getTime() - ny.getTime())).toISOString();
}

export async function saveEvent(form: FormData) {
  const supabase = await supabaseServer();
  const id = String(form.get('id') || '');
  const starts = nyToIso(String(form.get('starts_at') || ''));
  const ends = form.get('ends_at') ? nyToIso(String(form.get('ends_at'))) : '';
  const back = id ? `/admin/events/${id}` : '/admin/events/new';
  if (!starts) redirect(`${back}?error=` + encodeURIComponent('Add a start date and time.'));
  const payload = {
    id, title: String(form.get('title') || '').trim(), description: String(form.get('description') || '').trim(),
    venue: String(form.get('venue') || '').trim(), address: String(form.get('address') || '').trim(), area: String(form.get('area') || ''),
    starts_at: starts, ends_at: ends, capacity: String(form.get('capacity') || ''), price_note: String(form.get('price_note') || '').trim(),
    black_priority_hours: String(form.get('black_priority_hours') || '48'), status: String(form.get('status') || 'draft'),
  };
  const { data, error } = await supabase.rpc('staff_save_event', { p: payload });
  if (error) redirect(`${back}?error=` + encodeURIComponent(error.message));
  revalidatePath('/admin/events');
  redirect(`/admin/events/${data}?saved=1`);
}

/** Email members about a published event. During the Reserve priority window only Reserve members get it. */
export async function announceEvent(form: FormData) {
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  const { data: e } = await supabase.from('events').select('*').eq('id', id).single();
  if (!e || e.status !== 'published') redirect(`/admin/events/${id}?error=` + encodeURIComponent('Publish the event first.'));
  const blackOnly = new Date(e.published_at).getTime() + e.black_priority_hours * 3600000 > Date.now();
  const { data: people, error } = await supabaseAnon().rpc('event_audience', { p_secret: process.env.SCORE_SERVER_SECRET, p_event: id, p_black_only: blackOnly });
  if (error) redirect(`/admin/events/${id}?error=` + encodeURIComponent(error.message));
  const rows = ((people as { user_id: string; email: string | null; first_name: string | null }[]) || []).filter((p) => p.email);
  const r = await sendBatch('event_announce', rows.map((p) => ({
    to: p.email!, unsubUrl: unsubUrl(p.user_id, 'events'),
    data: { first_name: p.first_name, title: e.title, when: when(e.starts_at), venue: e.venue, event_id: id, black_only: blackOnly },
  })));
  redirect(`/admin/events/${id}?sent=` + encodeURIComponent(`${r.sent} sent${blackOnly ? ' to Reserve members' : ''}${r.failed ? `, ${r.failed} failed (${r.error})` : ''}`));
}
