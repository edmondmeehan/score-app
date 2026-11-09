'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';

const back = (q: string) => redirect('/admin/featured?' + q);
const t = (f: FormData, k: string, n: number) => String(f.get(k) || '').trim().slice(0, n) || null;
const num = (f: FormData, k: string) => { const v = Number(f.get(k)); return f.get(k) && Number.isFinite(v) ? v : null; };
const day = (f: FormData, k: string) => { const v = String(f.get(k) || ''); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; };

/** Create or update a featured date spot. */
export async function saveSpot(form: FormData) {
  const { supabase } = await requireStaff();
  const id = String(form.get('id') || '');
  const name = t(form, 'name', 120);
  if (!name || name.length < 2) back('error=' + encodeURIComponent('Pick a venue.'));
  const placeId = String(form.get('place_id') || '').trim();
  const row = {
    name, place_id: /^[A-Za-z0-9_-]{10,300}$/.test(placeId) ? placeId : null,
    address: t(form, 'address', 200), lat: num(form, 'lat'), lng: num(form, 'lng'),
    neighborhood: t(form, 'neighborhood', 80), blurb: t(form, 'blurb', 160), perk: t(form, 'perk', 140),
    badge: t(form, 'badge', 30) || 'ScoreDate Partner', priority: Math.round(num(form, 'priority') || 0),
    active: form.get('active') === 'on', starts_on: day(form, 'starts_on'), ends_on: day(form, 'ends_on'),
    monthly_fee: num(form, 'monthly_fee'), contact_name: t(form, 'contact_name', 80), contact_email: t(form, 'contact_email', 160),
    notes: t(form, 'notes', 1000), updated_at: new Date().toISOString(),
  };
  const { error } = id ? await supabase.from('featured_spots').update(row).eq('id', id) : await supabase.from('featured_spots').insert(row);
  revalidatePath('/admin/featured');
  back(error ? 'error=' + encodeURIComponent(/relation|schema/.test(error.message) ? 'Run migration 0040 in the SQL Editor first.' : error.message) : 'ok=' + encodeURIComponent(id ? 'Saved.' : 'Added.'));
}

export async function deleteSpot(form: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from('featured_spots').delete().eq('id', String(form.get('id')));
  revalidatePath('/admin/featured');
  back(error ? 'error=' + encodeURIComponent(error.message) : 'ok=' + encodeURIComponent('Removed.'));
}
