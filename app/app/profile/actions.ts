'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { getTrack, parseTrackId } from '@/lib/spotify';
import { PROMPTS } from '@/lib/prompts';
import { DRINKING, EDUCATION, EXERCISE, HAS_KIDS, HEIGHTS, LOOKING_FOR, NYC_SLOTS, PETS, POLITICS, RELIGION, SMOKING, WANTS_KIDS, valid, type NycSpot } from '@/lib/profileDetails';


async function ctx() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');
  return { supabase, user };
}
const back = (q: string) => redirect('/app/profile?' + q);

export async function saveAbout(form: FormData) {
  const { supabase, user } = await ctx();
  const { error } = await supabase.from('profiles').update({
    job: String(form.get('job') || '').trim().slice(0, 80) || null,
    neighborhood: String(form.get('neighborhood') || '').trim().slice(0, 80) || null,
  }).eq('id', user.id);
  back(error ? 'error=' + encodeURIComponent(error.message) : 'saved=about');
}

export async function saveFlags(form: FormData) {
  const { supabase, user } = await ctx();
  const t = (k: string, n: number) => String(form.get(k) || '').trim().slice(0, n) || null;
  const { error } = await supabase.from('profiles').update({
    flag_habit: t('flag_habit', 120), flag_splurge: t('flag_splurge', 60), flag_save: t('flag_save', 60),
    show_verified: form.get('show_verified') === 'on',
  }).eq('id', user.id);
  back(error ? 'error=' + encodeURIComponent(error.message) : 'saved=flags');
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

export async function saveDetails(form: FormData) {
  const { supabase, user } = await ctx();
  const h = Number(form.get('height_cm'));
  const { error } = await supabase.from('profiles').update({
    height_cm: HEIGHTS.some((x) => x.cm === h) ? h : null,
    has_kids: valid(HAS_KIDS, form.get('has_kids')),
    wants_kids: valid(WANTS_KIDS, form.get('wants_kids')),
    education: valid(EDUCATION, form.get('education')),
    drinking: valid(DRINKING, form.get('drinking')),
    smoking: valid(SMOKING, form.get('smoking')),
    exercise: valid(EXERCISE, form.get('exercise')),
    looking_for: valid(LOOKING_FOR, form.get('looking_for')),
    pets: valid(PETS, form.get('pets')),
    religion: valid(RELIGION, form.get('religion')),
    politics: valid(POLITICS, form.get('politics')),
  }).eq('id', user.id);
  if (error) back('error=' + encodeURIComponent(/column|schema/.test(error.message) ? 'Profile details are almost ready. Please try again later.' : error.message));
  revalidatePath('/app/profile');
  back('saved=details#details');
}

/** Up to three prompts. The first one also fills prompt_q / prompt_a, which older screens still read. */
export async function savePrompts(form: FormData) {
  const { supabase, user } = await ctx();
  const prompts: { q: string; a: string }[] = [];
  const seen = new Set<string>();
  for (const i of [0, 1, 2]) {
    const q = String(form.get(`q${i}`) || '');
    const a = String(form.get(`a${i}`) || '').trim().slice(0, 200);
    if (!a || !PROMPTS.includes(q) || seen.has(q)) continue;
    seen.add(q);
    prompts.push({ q, a });
  }
  const { error } = await supabase.from('profiles').update({
    prompts, prompt_q: prompts[0]?.q ?? PROMPTS[0], prompt_a: prompts[0]?.a ?? null,
  }).eq('id', user.id);
  revalidatePath('/app/profile');
  back(error ? 'error=' + encodeURIComponent(/column|schema/.test(error.message) ? 'Prompts are almost ready. Please try again later.' : error.message) : 'saved=prompts#prompts');
}

/** Save one My NYC spot (or clear it). */
export async function saveNycSpot(form: FormData) {
  const { supabase, user } = await ctx();
  const slot = String(form.get('slot') || '');
  if (!NYC_SLOTS.some((s) => s.key === slot)) back('error=' + encodeURIComponent('Pick a spot.'));
  const { data: me } = await supabase.from('profiles').select('my_nyc').eq('id', user.id).single();
  const current = ((me?.my_nyc as NycSpot[] | null) || []).filter((s) => s.slot !== slot && NYC_SLOTS.some((x) => x.key === s.slot));
  const name = String(form.get('spot_name') || '').trim().slice(0, 100);
  const placeId = String(form.get('place_id') || '').trim();
  if (name && form.get('clear') !== '1') {
    current.push({ slot, name, place_id: /^[A-Za-z0-9_-]{10,300}$/.test(placeId) ? placeId : null, note: String(form.get('note') || '').trim().slice(0, 120) || null });
  }
  current.sort((a, b) => NYC_SLOTS.findIndex((s) => s.key === a.slot) - NYC_SLOTS.findIndex((s) => s.key === b.slot));
  const { error } = await supabase.from('profiles').update({ my_nyc: current }).eq('id', user.id);
  revalidatePath('/app/profile');
  back(error ? 'error=' + encodeURIComponent(/column|schema/.test(error.message) ? 'My NYC is almost ready. Please try again later.' : error.message) : 'saved=nyc#nyc');
}

export async function saveImproving(form: FormData) {
  const { supabase, user } = await ctx();
  const { error } = await supabase.from('profiles').update({ show_improving: form.get('show') === 'on' }).eq('id', user.id);
  back(error ? 'error=' + encodeURIComponent(/column|schema/.test(error.message) ? 'Almost ready. Please try again later.' : error.message) : 'saved=improving#improving');
}

export async function answerVouch(form: FormData) {
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('answer_vouch', { p_show: form.get('show') === 'yes' });
  back(error ? 'error=' + encodeURIComponent(error.message) : 'saved=vouch');
}

export async function setVoiceIntro(path: string, seconds: number) {
  const { supabase, user } = await ctx();
  if (path && !path.startsWith(`${user.id}/`)) return { ok: false, error: 'Upload failed' };
  const { data: old } = await supabase.from('profiles').select('voice_path').eq('id', user.id).single();
  const { error } = await supabase.rpc('set_voice', { p_path: path, p_seconds: seconds });
  if (!error && old?.voice_path && old.voice_path !== path) await supabase.storage.from('voices').remove([old.voice_path]);
  revalidatePath('/app/profile');
  return { ok: !error, error: error?.message };
}
