'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export async function savePost(form: FormData) {
  const supabase = await supabaseServer();
  const v = (k: string) => String(form.get(k) || '').trim();
  const id = v('id');
  const back = id ? `/admin/content/${id}` : '/admin/content/new';
  if (v('url') && !/^https:\/\//.test(v('url'))) redirect(`${back}?error=` + encodeURIComponent('Links must start with https://'));
  const { data, error } = await supabase.rpc('staff_save_post', { p: {
    id, kind: v('kind'), title: v('title'), body: v('body'), source_name: v('source_name'), url: v('url'),
    partner_name: v('partner_name'), perk_code: v('perk_code'), status: v('status') || 'draft', pinned: form.get('pinned') === 'on',
  } });
  if (error) redirect(`${back}?error=` + encodeURIComponent(error.message));
  revalidatePath('/admin/content'); revalidatePath('/app/discover');
  redirect(`/admin/content/${data}?saved=1`);
}

export async function deletePost(form: FormData) {
  const supabase = await supabaseServer();
  await supabase.rpc('staff_delete_post', { p_id: String(form.get('id')) });
  revalidatePath('/admin/content');
  redirect('/admin/content');
}

export async function reviewStory(form: FormData) {
  const supabase = await supabaseServer();
  await supabase.rpc('staff_review_story', { p_id: String(form.get('id')), p_status: String(form.get('status')) });
  revalidatePath('/admin/content');
  redirect('/admin/content?tab=stories');
}

export async function setInquiry(form: FormData) {
  const supabase = await supabaseServer();
  await supabase.rpc('staff_set_inquiry', { p_id: String(form.get('id')), p_status: String(form.get('status')) });
  revalidatePath('/admin/content');
  redirect('/admin/content?tab=partners');
}
