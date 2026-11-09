import type { Profile } from './types';

type Step = { done: boolean; weight: number; label: string; href: string };

/** How complete a profile is, and the single most useful next step. Weights favor what drives matches (photos, prompts). */
export function profileStrength(me: Profile, photoCount: number) {
  const prompts = (me.prompts || []).filter((p) => p?.a?.trim());
  const nyc = (me.my_nyc || []).filter((s) => s?.name);
  const steps: Step[] = [
    { done: photoCount >= 3, weight: 25, label: photoCount ? `Add ${3 - photoCount} more photo${3 - photoCount === 1 ? '' : 's'}` : 'Add 3 photos', href: '/app/profile?add=1#add' },
    { done: prompts.length >= 2, weight: 20, label: prompts.length ? 'Answer one more prompt' : 'Answer two prompts', href: '/app/profile#prompts' },
    { done: Boolean(me.neighborhood?.trim()), weight: 10, label: 'Add your neighborhood', href: '/app/profile#about' },
    { done: nyc.length >= 1, weight: 10, label: 'Pin a spot to My NYC', href: '/app/profile#nyc' },
    { done: Boolean(me.looking_for), weight: 10, label: 'Say what you’re looking for', href: '/app/profile#details' },
    { done: Boolean(me.job?.trim()), weight: 5, label: 'Add your job', href: '/app/profile#about' },
    { done: Boolean(me.song_title), weight: 5, label: 'Pick your song', href: '/app/profile#song' },
    { done: (me.money_values || []).length >= 3, weight: 10, label: 'Finish the money questions', href: '/onboarding/quiz' },
    { done: Boolean(me.credit_verified_at), weight: 5, label: 'Verify your band', href: '/onboarding/credit' },
  ];
  const total = steps.reduce((t, s) => t + s.weight, 0);
  const pct = Math.round((steps.filter((s) => s.done).reduce((t, s) => t + s.weight, 0) / total) * 100);
  const next = steps.filter((s) => !s.done).sort((a, b) => b.weight - a.weight)[0] || null;
  return { pct, next };
}
