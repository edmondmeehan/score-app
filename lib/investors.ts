import 'server-only';
import { createHash, randomBytes, scryptSync } from 'node:crypto';

export const INVESTOR_COOKIE = 'score_inv';

export const hashPassword = (pw: string, salt: string) => scryptSync(pw, salt, 32).toString('hex');
export const newSalt = () => randomBytes(16).toString('hex');
export const newToken = () => randomBytes(32).toString('hex');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export type Line = { a: string; b: string; c?: string };
export type InvestorContent = {
  headline: string;
  summary: string;
  problem: string;
  solution: string;
  how: string; // one step per line
  why_now: string;
  moat: string; // one point per line
  trust: string; // one point per line
  team: string; // Name | Role | short bio, one per line
  raise_amount: string;
  raise_instrument: string;
  raise_terms: string;
  raise_use: string; // Label | %   one per line
  raise_milestones: string; // one per line
  contact_name: string;
  contact_email: string;
  disclaimer: string;
};

export const CONTENT_DEFAULT: InvestorContent = {
  headline: 'The dating app where financial compatibility comes first.',
  summary: 'ScoreDate is an invite-only dating app for people who take their future seriously. Every member verifies their identity and a credit band, so matches start with honesty about money, one of the top sources of stress in relationships. We launch in New York City and expand market by market as waitlist demand proves out.',
  problem: 'Money is one of the most common sources of conflict in relationships, yet it is the one thing dating apps never ask about. Mainstream apps are crowded with unverified profiles, people who aren’t serious, and no signal on life stage or financial habits. Members end up spending months getting to a conversation that should happen early.',
  solution: 'ScoreDate verifies two things before anyone can match: who you are (government ID and a live selfie) and your credit band, checked with a soft inquiry that never affects your score. Members see bands and trends, never exact scores. Matching weighs bands, money values and dating preferences, and the community stays small and high-intent through invites and a waitlist.',
  how: 'Request an invite or use a member’s code\nVerify your ID and selfie\nConnect your credit band with a soft inquiry (no impact on your score)\nGet a curated Daily Drop of matches and say hello\nPlan dates in the app, with safety sharing and check-ins',
  why_now: 'Open-banking and credit-data APIs now make a consumer-permissioned soft check fast and inexpensive. ID and selfie verification is reliable and affordable. And daters are tired of swipe fatigue and fake profiles: invite-only, verified communities have shown people will pay a premium for quality.',
  moat: 'Verified credit band on every profile: a signal no mainstream app offers\nInvite-only growth: members vouch for each other, which keeps quality high and acquisition costs low\nMarket-by-market launches gated by real waitlist demand, so we only enter cities that are ready\nA brand built on trust, privacy and financial wellness, with partner perks and member events',
  trust: 'Soft inquiry only: checking a band never affects a member’s credit score\nScore never sees or stores exact scores or credit reports, only the band and trend\nID and selfie verification on every member, plus photo review\nBuilt to follow App Store and Google Play rules, including easy cancellation and a low-cost Pause option\nSafety center, reporting, moderation tools and date check-ins',
  team: 'Eddie Meehan | Founder & CEO | 20+ years building fan-experience businesses. Founder of Please & Thank You; prior exits include Wonderful Union (acquired by Endeavor) and Queue (acquired by Eventbrite).',
  raise_amount: 'TBD',
  raise_instrument: 'TBD',
  raise_terms: 'Terms to be shared directly.',
  raise_use: 'Product & engineering | 35\nMarketing & market launches | 35\nTrust, safety & verification | 15\nG&A and working capital | 15',
  raise_milestones: 'Launch New York City and the Hamptons\nReach the first paying-member milestones in NYC\nOpen Connecticut and Boston\nPrepare the Los Angeles and San Francisco launches',
  contact_name: 'Eddie Meehan',
  contact_email: 'eddie@please.co',
  disclaimer: 'Confidential. For discussion purposes only. This is not an offer to sell or a solicitation of an offer to buy any security; any offer will be made only through definitive documents. The financial model is illustrative and based on assumptions that may not prove correct; it is not a forecast or a guarantee of future results. Waitlist figures are live counts and do not represent paying members.',
};

export function mergeContent(v: unknown): InvestorContent {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<InvestorContent>;
  const out = { ...CONTENT_DEFAULT };
  for (const k of Object.keys(CONTENT_DEFAULT) as (keyof InvestorContent)[]) if (typeof o[k] === 'string') out[k] = o[k] as string;
  return out;
}

export const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
export const cells = (s: string): Line[] => lines(s).map((l) => { const [a, b = '', c] = l.split('|').map((x) => x.trim()); return { a, b, c }; });
