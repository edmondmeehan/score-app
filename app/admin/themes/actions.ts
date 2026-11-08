'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireStaff } from '@/lib/session';
import { SEASONS, type Effect, type SeasonConfig, type SeasonKey } from '@/lib/seasons';

const EFFECTS: Effect[] = ['none', 'snow', 'confetti', 'hearts', 'leaves', 'embers', 'sparks'];
const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const err = (m: string) => (/Could not find the function/i.test(m) ? 'Run migration 0027 in the ScoreDate SQL Editor first.' : m);

export async function saveSeasons(form: FormData) {
  const { supabase } = await requireStaff();
  const force = String(form.get('force') || '');
  const cfg: SeasonConfig = { enabled: form.get('enabled') === 'on', force: (force === 'off' || SEASONS.some((s) => s.key === force) ? force : null) as SeasonConfig['force'], overrides: {} };
  const errors: string[] = [];
  for (const s of SEASONS) {
    const start = String(form.get(`${s.key}_start`) || '').trim();
    const end = String(form.get(`${s.key}_end`) || '').trim();
    const auto = s.key === 'thanksgiving' && (start === '' || start === 'auto');
    if (!auto && (!MD.test(start) || !MD.test(end))) { errors.push(`${s.name}: dates must look like MM-DD`); continue; }
    const effect = String(form.get(`${s.key}_effect`) || s.effect) as Effect;
    cfg.overrides[s.key as SeasonKey] = {
      enabled: form.get(`${s.key}_enabled`) === 'on',
      start: auto ? 'auto' : start, end: auto ? 'auto' : end,
      banner: String(form.get(`${s.key}_banner`) || '').trim().slice(0, 140),
      effect: EFFECTS.includes(effect) ? effect : 'none',
    };
  }
  if (errors.length) redirect('/admin/themes?error=' + encodeURIComponent(errors.join('. ')));
  const { error } = await supabase.rpc('staff_set_seasons', { p: cfg });
  if (error) redirect('/admin/themes?error=' + encodeURIComponent(err(error.message)));
  revalidateTag('seasons');
  revalidatePath('/', 'layout');
  redirect('/admin/themes?ok=' + encodeURIComponent('Saved. Changes show across the site within a minute.'));
}

/** Preview a theme in your own browser only (1 hour). */
export async function previewSeason(form: FormData) {
  await requireStaff();
  const key = String(form.get('key') || '');
  const store = await cookies();
  if (!key) store.delete('score_season_preview');
  else store.set('score_season_preview', key, { path: '/', maxAge: 3600, sameSite: 'lax', secure: true, httpOnly: true });
  redirect(key ? '/?' : '/admin/themes?ok=' + encodeURIComponent('Preview ended.'));
}
