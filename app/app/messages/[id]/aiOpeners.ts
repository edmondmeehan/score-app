'use server';
import { requireMember } from '@/lib/session';
import { aiReady, generate } from '@/lib/ai';
import { LOOKING_FOR, NYC_SLOTS, label } from '@/lib/profileDetails';
import type { Profile } from '@/lib/types';

export type AiResult = { ideas?: string[]; status: 'ok' | 'off' | 'other_off' | 'limit' | 'unavailable' };

/** Only what members chose to show on their profile. Never credit band, religion, politics, health or contact details. */
function card(p: Profile) {
  const spots = (p.my_nyc || []).map((s) => `${NYC_SLOTS.find((x) => x.key === s.slot)?.label || 'Spot'}: ${s.name}${s.note ? ` (${s.note})` : ''}`);
  return [
    `First name: ${p.first_name || ''}`,
    p.job && `Job: ${p.job}`,
    p.neighborhood && `Neighborhood: ${p.neighborhood}`,
    p.looking_for && `Looking for: ${label(LOOKING_FOR, p.looking_for)}`,
    p.song_title && `Profile song: ${p.song_title}${p.song_artist ? ` by ${p.song_artist}` : ''}`,
    ...(p.prompts || []).map((x) => `Prompt "${x.q}" answer: ${x.a}`),
    ...spots,
    p.flag_splurge && `Splurges on: ${p.flag_splurge}`,
  ].filter(Boolean).join('\n');
}

export async function turnOnAiIdeas(on: boolean) {
  const { supabase } = await requireMember();
  await supabase.rpc('set_ai_ideas', { p_on: on });
}

export async function aiOpeners(conversationId: string): Promise<AiResult> {
  if (!aiReady()) return { status: 'unavailable' };
  const { supabase, me } = await requireMember();
  if (!me.ai_ideas) return { status: 'off' };
  const { data: conv } = await supabase.from('conversations').select('user_a, user_b').eq('id', conversationId).maybeSingle();
  if (!conv) return { status: 'unavailable' };
  const otherId = conv.user_a === me.id ? conv.user_b : conv.user_a;
  const { data: o } = await supabase.from('profiles').select('*').eq('id', otherId).maybeSingle();
  const other = o as Profile | null;
  if (!other) return { status: 'unavailable' };
  if (!other.ai_ideas) return { status: 'other_off' };
  const { data: ok } = await supabase.rpc('ai_take', { p_limit: 40 });
  if (!ok) return { status: 'limit' };

  const shared = (other.money_values || []).filter((v) => me.money_values?.includes(v));
  const system = 'You write first messages for a dating app in New York. Write 3 different openers the sender could send. Each must be warm, specific to something real on the other person\'s profile, end with an easy question, sound like a real person texting (not a pickup line, no emojis, no hashtags), and be under 140 characters. Never mention money amounts, credit, income, looks or bodies. Vary the angle each time: one playful, one curious, one that suggests a low-key plan. Reply with only a JSON array of 3 strings.';
  const user = `Sender:\n${card(me)}\n\nRecipient:\n${card(other)}${shared.length ? `\n\nBoth picked these money values: ${shared.join(', ')}` : ''}\n\nRandom seed for variety: ${Math.random().toString(36).slice(2, 8)}`;
  const out = await generate(system, user, 400);
  if (!out) return { status: 'unavailable' };
  try {
    const arr = JSON.parse(out.slice(out.indexOf('['), out.lastIndexOf(']') + 1)) as unknown[];
    const ideas = arr.filter((x): x is string => typeof x === 'string').map((s) => s.trim().slice(0, 200)).filter(Boolean).slice(0, 3);
    return ideas.length ? { ideas, status: 'ok' } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
