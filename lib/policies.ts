import { unstable_cache } from 'next/cache';
import { supabaseAnon } from '@/lib/supabase/server';
import { DOCS, type Block, type Doc, type Section } from '@/lib/docs';

/** Pages editable in /admin/policies. */
export const POLICY_SLUGS = ['privacy', 'terms', 'biometric', 'choices', 'cookies', 'community'] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];
export const isPolicySlug = (s: string): s is PolicySlug => (POLICY_SLUGS as readonly string[]).includes(s);

/** What gets saved: the plain-text body (see docToText) plus the header fields. */
export type SavedDoc = { title: string; summary: string; updated: string; draft: boolean; body: string };

const slugify = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'section';

/** Sections → editable text.  "## Heading {#id}", "### Subheading", "- list item", blank line between paragraphs. */
export function docToText(sections: Section[]): string {
  return sections.map((s) => [`## ${s.h} {#${s.id}}`, ...s.body.map((b) =>
    typeof b === 'string' ? b : 'ul' in b ? b.ul.map((li) => `- ${li}`).join('\n') : `### ${b.h3}`)].join('\n\n')).join('\n\n');
}

/** Editable text → sections. Returns errors for things that would break the page. */
export function textToSections(text: string): { sections: Section[]; errors: string[] } {
  const sections: Section[] = []; const errors: string[] = []; const ids = new Set<string>();
  let cur: Section | null = null; let para: string[] = []; let list: string[] = [];
  const flush = () => {
    if (!cur) { if (para.length || list.length) errors.push('Text before the first “## Heading” line. Start with a heading.'); para = []; list = []; return; }
    if (para.length) cur.body.push(para.join(' ')); if (list.length) cur.body.push({ ul: list });
    para = []; list = [];
  };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    const h2 = line.match(/^##\s+(.+?)(?:\s*\{#([a-z0-9-]+)\})?$/i);
    if (h2 && !line.startsWith('###')) {
      flush();
      let id = (h2[2] || slugify(h2[1])).toLowerCase(); const base = id; let n = 2;
      while (ids.has(id)) id = `${base}-${n++}`;
      ids.add(id); cur = { id, h: h2[1].trim(), body: [] }; sections.push(cur); continue;
    }
    if (line.startsWith('###')) { flush(); if (cur) cur.body.push({ h3: line.replace(/^###\s*/, '') }); else errors.push('Subheading before the first “## Heading”.'); continue; }
    if (/^[-*]\s+/.test(line)) { if (para.length) { cur?.body.push(para.join(' ')); para = []; } list.push(line.replace(/^[-*]\s+/, '')); continue; }
    if (!line) { flush(); continue; }
    if (list.length) { cur?.body.push({ ul: list }); list = []; }
    para.push(line);
  }
  flush();
  if (!sections.length) errors.push('Add at least one “## Heading” section.');
  for (const s of sections) if (!s.body.length) errors.push(`“${s.h}” has no text under it.`);
  return { sections, errors };
}

export function mergeDoc(slug: PolicySlug, saved: unknown): Doc & { custom: boolean } {
  const base = DOCS[slug];
  const v = saved as Partial<SavedDoc> | null;
  if (!v || typeof v !== 'object' || typeof v.body !== 'string') return { ...base, custom: false };
  const { sections, errors } = textToSections(v.body);
  if (errors.length) return { ...base, custom: false };
  return { ...base, title: v.title || base.title, summary: v.summary ?? base.summary, updated: v.updated || base.updated, draft: Boolean(v.draft), sections, custom: true };
}

/** A policy as the public sees it: the saved version if there is one, otherwise the built-in text. */
export const getPolicy = (slug: PolicySlug) => unstable_cache(async () => {
  try {
    const { data } = await supabaseAnon().from('app_config').select('value').eq('key', `doc:${slug}`).maybeSingle();
    return mergeDoc(slug, data?.value);
  } catch {
    return { ...DOCS[slug], custom: false };
  }
}, ['policy', slug], { tags: ['policies', `policy:${slug}`], revalidate: 300 })();

// ---------- Partners page ----------
export type PartnersPage = { eyebrow: string; title: string; intro: string; facts: [string, string][]; ways: [string, string][] };
export const PARTNERS_DEFAULT: PartnersPage = {
  eyebrow: 'Partnerships',
  title: 'Meet members who have their act together.',
  intro: 'ScoreDate is invite-only dating for verified members who are honest about money. We partner with a small number of venues and brands members will love.',
  facts: [['Verified', 'Every member verifies their ID and credit band'], ['25+', 'Members are 25 and older'], ['NYC first', 'Launching across the five boroughs']],
  ways: [
    ['Venues', 'Host a ScoreDate night. Supper clubs, wine bars, rooftops and listening rooms that want a full room of verified members on a quiet weeknight.'],
    ['Member perks', 'Offer something to members: a welcome drink, a tasting menu, early reservations. It shows up in the Discover tab with your name on it.'],
    ['Financial wellness', 'Banks, advisors and credit educators who want to teach. Workshops and expert tips for members who already care about their finances.'],
    ['Brands & events', 'Sponsor an event series, a date-night collection or a city launch. We keep it tasteful and in line with what members actually want.'],
  ],
};
const pairs = (x: unknown) => (Array.isArray(x) ? x.filter((p) => Array.isArray(p) && p.length === 2 && p.every((s) => typeof s === 'string')) as [string, string][] : null);
export function mergePartners(v: unknown): PartnersPage & { custom: boolean } {
  const s = (v && typeof v === 'object' ? v : null) as Partial<PartnersPage> | null;
  if (!s) return { ...PARTNERS_DEFAULT, custom: false };
  return {
    eyebrow: s.eyebrow || PARTNERS_DEFAULT.eyebrow, title: s.title || PARTNERS_DEFAULT.title, intro: s.intro ?? PARTNERS_DEFAULT.intro,
    facts: pairs(s.facts) ?? PARTNERS_DEFAULT.facts, ways: pairs(s.ways) ?? PARTNERS_DEFAULT.ways, custom: true,
  };
}
export const getPartnersPage = unstable_cache(async () => {
  try {
    const { data } = await supabaseAnon().from('app_config').select('value').eq('key', 'doc:partners').maybeSingle();
    return mergePartners(data?.value);
  } catch {
    return { ...PARTNERS_DEFAULT, custom: false };
  }
}, ['policy', 'partners'], { tags: ['policies', 'policy:partners'], revalidate: 300 });

/** "Title | text" per line ↔ pairs. */
export const pairsToText = (p: [string, string][]) => p.map(([a, b]) => `${a} | ${b}`).join('\n');
export function textToPairs(t: string, what: string): { pairs: [string, string][]; errors: string[] } {
  const out: [string, string][] = []; const errors: string[] = [];
  for (const raw of t.replace(/\r/g, '').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    const i = line.indexOf('|');
    if (i < 1 || !line.slice(i + 1).trim()) { errors.push(`${what}: “${line.slice(0, 40)}” needs “Title | text”`); continue; }
    out.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return { pairs: out, errors };
}
export type { Block };
