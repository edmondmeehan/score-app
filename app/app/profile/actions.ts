'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { getTrack, parseTrackId } from '@/lib/spotify';
import { PROMPTS } from '@/lib/prompts';


async function ctx() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');
  return { supabase, user };
}
const back = (q: string) => redirect('/app/profile?' + q);

export async function saveAbout(form: FormData) {
  const { supabase, user } = await ctx();
  const q = String(form.get('prompt_q') || '');
  const { error } = await supabase.from('profiles').update({
    job: String(form.get('job') || '').trim().slice(0, 80) || null,
    neighborhood: String(form.get('neighborhood') || '').trim().slice(0, 80) || null,
    prompt_q: PROMPTS.includes(q) ? q : PROMPTS[0],
    prompt_a: String(form.get('prompt_a') || '').trim().slice(0, 160) || null,
  }).eq('id', user.id);
  back(error ? 'error=' + encodeURIComponent(error.message) : 'saved=about');
}

export async function setSong(form: FormData) {
  const { supabase, user } = await ctx();
  const id = parseTrackId(String(form.get('track') || ''));
  if (!id) back('error=' + encodeURIComponent('That doesn’t look like a Spotify song link. In Spotify: Share → Copy song link.'));
  const t = await getTrack(id!);
  if (!t) back('error=' + encodeURIComponent('We couldn’t find that song on Spotify.'));
  const image = t!.image && /^https:\/\/(i\.scdn\.co|image-cdn-[a-z0-9-]+\.spotifycdn\.com)\//.test(t!.image) ? t!.image : null;
  const { error } = await supabase.from('profiles').update({ song_id: t!.id, song_title: t!.title.slice(0, 200), song_artist: t!.artist?.slice(0, 200) ?? null, song_image: image }).eq('id', user.id);
  back(error ? 'error=' + encodeURIComponent(error.message) : 'saved=song');
}

export async function clearSong() {
  const { supabase, user } = await ctx();
  await supabase.from('profiles').update({ song_id: null, song_title: null, song_artist: null, song_image: null }).eq('id', user.id);
  back('saved=song');
}

export async function saveInstagram(form: FormData) {
  const { supabase, user } = await ctx();
  let handle = String(form.get('instagram') || '').trim();
  handle = handle.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?].*$/, '');
  if (handle && !/^[A-Za-z0-9._]{1,30}$/.test(handle)) back('error=' + encodeURIComponent('Instagram handles use letters, numbers, periods and underscores (30 max).'));
  const { error } = handle
    ? await supabase.from('profile_socials').upsert({ user_id: user.id, instagram: handle, instagram_public: form.get('public') === 'on', updated_at: new Date().toISOString() })
    : await supabase.from('profile_socials').delete().eq('user_id', user.id);
  back(error ? 'error=' + encodeURIComponent(error.message) : 'saved=instagram');
}

export async function removePhoto(form: FormData) {
  const { supabase, user } = await ctx();
  const id = String(form.get('id'));
  const { data: photos } = await supabase.from('photos').select('id, path, match_status').eq('user_id', user.id);
  const target = photos?.find((p) => p.id === id);
  if (!target) back('error=' + encodeURIComponent('Photo not found.'));
  const approvedLeft = (photos || []).filter((p) => p.match_status === 'approved' && p.id !== id).length;
  if (target!.match_status === 'approved' && approvedLeft === 0) back('error=' + encodeURIComponent('Keep at least one approved photo. Add a new one first, then remove this.'));
  await supabase.storage.from('photos').remove([target!.path]);
  const { error } = await supabase.from('photos').delete().eq('id', id).eq('user_id', user.id);
  revalidatePath('/app/profile');
  back(error ? 'error=' + encodeURIComponent(error.message) : 'saved=photos');
}

export async function movePhoto(form: FormData) {
  const { supabase, user } = await ctx();
  const id = String(form.get('id'));
  const dir = String(form.get('dir')) === 'up' ? -1 : 1;
  const { data: photos } = await supabase.from('photos').select('id, position').eq('user_id', user.id).order('position');
  const list = photos || [];
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) back('');
  // Renumber everything so positions stay clean, then swap.
  const order = list.map((p) => p.id);
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(order.map((pid, k) => supabase.from('photos').update({ position: k }).eq('id', pid).eq('user_id', user.id)));
  back('saved=photos');
}
