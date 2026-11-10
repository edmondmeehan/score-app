'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';

const back = (q: string) => redirect('/admin/partners?' + q);
const t = (f: FormData, k: string, n: number) => String(f.get(k) || '').trim().slice(0, n);

export async function savePartner(form: FormData) {
  const { supabase } = await requireStaff();
  const name = t(form, 'name', 80);
  const slug = (t(form, 'slug', 40) || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const url = t(form, 'url', 1000);
  if (!name) back('error=' + encodeURIComponent('Add a name.'));
  if (!/^https:\/\//.test(url)) back('error=' + encodeURIComponent('The link must start with https://'));
  const { error } = await supabase.rpc('staff_save_partner', { p: {
    id: t(form, 'id', 40), slug, name, url, tagline: t(form, 'tagline', 140), score_type: t(form, 'score_type', 40),
    badge: t(form, 'badge', 30), sort: t(form, 'sort', 6), active: form.get('active') === 'on',
  } });
  revalidatePath('/admin/partners');
  revalidatePath('/onboarding/credit');
  back(error ? 'error=' + encodeURIComponent(/duplicate/.test(error.message) ? 'That short name is already used.' : error.message) : 'saved=1');
}

export async function deletePartner(form: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('staff_delete_partner', { p_id: String(form.get('id')) });
  revalidatePath('/admin/partners');
  back(error ? 'error=' + encodeURIComponent(error.message) : 'saved=1');
}
