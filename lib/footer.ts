import { unstable_cache } from 'next/cache';
import { supabaseAnon } from '@/lib/supabase/server';

export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterConfig = {
  tagline: string;
  company: string;
  address: string; // one line per row
  email: string;
  columns: FooterColumn[];
  copyright: string; // {year} is replaced with the current year
  disclaimer: string;
  app_links: FooterLink[];
};

export const FOOTER_DEFAULT: FooterConfig = {
  tagline: 'The invite-only dating app built around credit bands. Now open in New York City.',
  company: 'ScoreDate, LLC',
  address: '1133 Broadway, Suite 1301\nNew York, NY 10010',
  email: 'support@scoredate.app',
  columns: [
    { title: 'ScoreDate', links: [{ label: 'How it works', href: '/#how' }, { label: 'Where we’re live', href: '/#where' }, { label: 'Request an invite', href: '/#invite' }, { label: 'I have a code', href: '/join' }, { label: 'Sign in', href: '/signin' }, { label: 'Help center', href: '/help' }] },
    { title: 'Trust & safety', links: [{ label: 'Safety center', href: '/safety' }, { label: 'Community guidelines', href: '/legal/community' }, { label: 'Biometric data policy', href: '/legal/biometric' }, { label: 'Report a concern', href: '/safety#report' }, { label: 'Age requirements', href: '/legal/age' }] },
    { title: 'Company', links: [{ label: 'Partners', href: '/partners' }, { label: 'Press', href: '/press' }, { label: 'Brand & marketing', href: '/brand' }, { label: 'Contact', href: '/contact' }] },
    { title: 'Legal', links: [{ label: 'Terms of Service', href: '/legal/terms' }, { label: 'Privacy Policy', href: '/legal/privacy' }, { label: 'Your privacy choices', href: '/legal/choices' }, { label: 'Cookie notice', href: '/legal/cookies' }, { label: 'Accessibility', href: '/legal/accessibility' }] },
  ],
  copyright: '© {year} ScoreDate, LLC. All rights reserved. Members must be 25+.',
  disclaimer: 'ScoreDate is not a credit bureau, lender or credit repair service. ScoreDate never sees or stores your exact score or credit report. In an emergency, call 911.',
  app_links: [{ label: 'Partners', href: '/partners' }, { label: 'Privacy', href: '/legal/privacy' }, { label: 'Terms', href: '/legal/terms' }, { label: 'Biometric policy', href: '/legal/biometric' }],
};

export const MAX_COLUMNS = 5;

/** Links the footers must always keep (store review + privacy law). */
export const REQUIRED_LINKS: FooterLink[] = [
  { label: 'Terms of Service', href: '/legal/terms' },
  { label: 'Privacy Policy', href: '/legal/privacy' },
];

export const okHref = (h: string) => /^(\/[^\s]*|#[\w-]*|https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/.test(h);

export function mergeFooter(v: unknown): FooterConfig {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<FooterConfig>;
  return { ...FOOTER_DEFAULT, ...Object.fromEntries(Object.entries(o).filter(([, x]) => x !== null && x !== undefined)) } as FooterConfig;
}

/** Cached for 5 minutes; saving in Admin → Footer refreshes it right away. */
export const getFooter = unstable_cache(async (): Promise<FooterConfig> => {
  try {
    const { data } = await supabaseAnon().from('app_config').select('value').eq('key', 'footer').maybeSingle();
    return mergeFooter(data?.value);
  } catch {
    return FOOTER_DEFAULT;
  }
}, ['footer-config'], { tags: ['footer'], revalidate: 300 });

/** "Label | /link" per line → links. Returns errors for bad lines. */
export function parseLinks(text: string): { links: FooterLink[]; errors: string[] } {
  const links: FooterLink[] = []; const errors: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const i = line.lastIndexOf('|');
    const label = (i > 0 ? line.slice(0, i) : '').trim().slice(0, 60);
    const href = (i > 0 ? line.slice(i + 1) : '').trim();
    if (!label || !href) { errors.push(`“${line}” needs a label, then | then a link`); continue; }
    if (!okHref(href)) { errors.push(`“${href}” isn’t a valid link. Use /page, https://…, or mailto:…`); continue; }
    links.push({ label, href });
  }
  return { links, errors };
}

export const linksToText = (links: FooterLink[]) => links.map((l) => `${l.label} | ${l.href}`).join('\n');
