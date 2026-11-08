import { unstable_cache } from 'next/cache';
import { supabaseAnon } from '@/lib/supabase/server';

/**
 * Credit mode, switched in Admin → Verification.
 *  - 'self': members pick their own band from a free credit score (Credit Karma, Credit Sesame, their bank). Shown as "Self-reported".
 *  - 'verified': the original soft check through the credit partner (Spinwheel).
 * Rolling back is one click: switch to 'verified' and every self-reported member is asked to verify.
 */
export type CreditMode = 'self' | 'verified';

export const getCreditMode = unstable_cache(async (): Promise<CreditMode> => {
  try {
    const { data } = await supabaseAnon().from('app_config').select('value').eq('key', 'credit_mode').maybeSingle();
    return (data?.value as { mode?: string } | null)?.mode === 'self' ? 'self' : 'verified';
  } catch {
    return 'verified';
  }
}, ['credit-mode'], { tags: ['credit-mode'], revalidate: 300 });

/** Public copy that depends on the mode. Everything else on the site is worded to be true in both. */
export const CREDIT_COPY: Record<CreditMode, {
  heroLine: string; strip: [string, string]; formNote: string; meetLine: string; bandsAnswer: string; safetyBand: string; howBand: string;
}> = {
  verified: {
    heroLine: 'ScoreDate is the dating app where every member has verified their credit and their identity. Every band is welcome. Honesty about money is required.',
    strip: ['Soft pull only. Your score is never affected.', 'About 60 seconds'],
    formNote: 'Verification uses a soft pull and never affects your score.',
    meetLine: 'You also confirm a band (Elite, Strong, Solid or Building) through a soft check that doesn’t affect your credit. Other members see only your band, never a number.',
    bandsAnswer: 'No. It’s a soft inquiry, which doesn’t affect your credit score and isn’t visible to lenders.',
    safetyBand: 'Verified credit band',
    howBand: 'A soft check confirms your band. It never affects your score.',
  },
  self: {
    heroLine: 'ScoreDate is the dating app built around honesty about money. Every member verifies their identity and shares their credit band. Every band is welcome.',
    strip: ['Share your band, never your score.', 'Check yours free with Credit Karma, Credit Sesame or your bank'],
    formNote: 'You’ll share your credit band, never your score. Checking it on a free service doesn’t affect your credit.',
    meetLine: 'You also share your band (Elite, Strong, Solid or Building) from a free credit score, like Credit Karma, Credit Sesame or your bank. It shows as self-reported, and other members never see a number.',
    bandsAnswer: 'No. You check your score on a free service like Credit Karma, Credit Sesame or your bank, which doesn’t affect it, then choose the matching band. ScoreDate doesn’t pull your credit.',
    safetyBand: 'Self-reported credit band',
    howBand: 'You choose your band from a free credit score. It shows as self-reported.',
  },
};
