import type { Profile } from './types';
import { LOOKING_FOR, NYC_SLOTS, label } from './profileDetails';

/** The Daily Drop flips at 00:00 UTC (7pm New York in winter, 8pm in summer). */
export function nextDropAt(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function dropTimeLabel(now = new Date()): string {
  return nextDropAt(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).replace(':00', '');
}

const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();

/** One short, honest line on why this person is in your Drop. Only uses things both people chose to share. */
export function dropReason(me: Profile, p: Profile): string | null {
  const shared = (p.money_values || []).filter((v) => me.money_values?.includes(v));
  if (shared.length >= 2) return `You both picked “${shared[0]}” and “${shared[1]}”`;
  if (me.looking_for && p.looking_for && me.looking_for === p.looking_for && me.looking_for !== 'figuring_out') {
    return `You’re both looking for ${label(LOOKING_FOR, p.looking_for)?.toLowerCase()}`;
  }
  if (me.wants_kids && p.wants_kids && me.wants_kids === p.wants_kids && me.wants_kids !== 'open') return 'Same page on future kids';
  if (norm(me.song_artist) && norm(me.song_artist) === norm(p.song_artist)) return `${p.song_artist} is on both your profiles`;
  const myPlaces = new Set((me.my_nyc || []).map((s) => s.place_id || norm(s.name)).filter(Boolean));
  const spot = (p.my_nyc || []).find((s) => myPlaces.has(s.place_id || norm(s.name)));
  if (spot) return `You both love ${spot.name}`;
  if (norm(me.neighborhood) && norm(me.neighborhood) === norm(p.neighborhood)) return `Also in ${p.neighborhood}`;
  if (shared.length === 1) return `You both picked “${shared[0]}”`;
  return null;
}

/** Opening lines drawn from what the other person shared. The member edits before sending; nothing is sent automatically. */
export function openers(me: Profile, o: Profile): string[] {
  const out: string[] = [];
  const name = o.first_name || '';
  for (const pr of (o.prompts || []).slice(0, 2)) {
    if (pr?.q && pr?.a) out.push(`Your answer to “${pr.q}” caught my eye. ${pr.a.length > 60 ? 'Tell me more?' : 'What’s the story there?'}`);
  }
  const spot = (o.my_nyc || []).find((s) => s.name);
  if (spot) {
    const slot = NYC_SLOTS.find((x) => x.key === spot.slot)?.key;
    out.push(slot === 'date' ? `${spot.name} as a date spot is a strong pick. What do you order there?` : slot === 'weekend' ? `${spot.name} on weekends? I need to know what makes it the ritual.` : `${spot.name} is your favorite spot? What should I get the first time?`);
  }
  if (o.song_artist) out.push(`${o.song_artist} on your profile. Is that a recent obsession or a forever thing?`);
  const shared = (o.money_values || []).filter((v) => me.money_values?.includes(v));
  if (shared.length) out.push(`We both picked “${shared[0]}”. What does that look like for you day to day?`);
  if (o.neighborhood) out.push(`How long have you been in ${o.neighborhood}? Best spot nobody knows about?`);
  if (!out.length) out.push(`Hi ${name}! What’s the best thing you’ve done in the city lately?`);
  return Array.from(new Set(out)).slice(0, 3);
}

/** Preset, kind ways to end a chat that’s gone quiet. */
export const KIND_CLOSES = [
  'Hey, I don’t think we’re quite a match, but I really enjoyed chatting. Wishing you the best out there.',
  'I’m going to step back here. Thanks for the conversation, and good luck finding your person.',
  'Doesn’t feel like the timing is right for me. Thanks for being kind, and take care.',
] as const;

export const QUIET_HOURS = 48;

/** The ↑ trend is only shown to others when the member opted in to the Improving badge. */
export const publicTrend = (p: { trend?: string | null; show_improving?: boolean | null }) => (p.show_improving ? p.trend ?? null : null);
