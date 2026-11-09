'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireStaff } from '@/lib/session';
import { isPolicySlug, textToPairs, textToSections, type SavedDoc, type PartnersPage } from '@/lib/policies';

export type SaveResult = { ok?: string; errors?: string[] };
const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').replace(/\r/g, '').trim().slice(0, max);
const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
const migrationHint = (m: string) => (/function|does not exist|schema cache/i.test(m) ? 'Run migration 0048 in the ScoreDate SQL Editor first.' : m);

async function store(slug: string, value: unknown): Promise<SaveResult | null> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('staff_set_policy', { p_slug: slug, p_doc: value });
  if (error) return { errors: [migrationHint(error.message)] };
  revalidateTag(`policy:${slug}`);
  revalidatePath(slug === 'partners' ? '/partners' : `/legal/${slug}`);
  revalidatePath('/admin/policies', 'layout');
  return null;
}

export async function savePolicy(form: FormData): Promise<SaveResult> {
  const slug = text(form, 'slug', 40);
  if (!isPolicySlug(slug)) return { errors: ['Unknown policy'] };
  const body = text(form, 'body', 150000);
  const { errors } = textToSections(body);
  const title = text(form, 'title', 120);
  if (!title) errors.unshift('Title is required');
  if (errors.length) return { errors };
  const doc: SavedDoc = {
    title, body,
    summary: text(form, 'summary', 600),
    updated: form.get('bump') === 'on' ? today() : text(form, 'updated', 60) || today(),
    draft: form.get('draft') === 'on',
  };
  return (await store(slug, doc)) ?? { ok: `Saved. The live page is updated${form.get('bump') === 'on' ? ` and shows “Last updated ${doc.updated}”` : ''}.` };
}

export async function savePartners(form: FormData): Promise<SaveResult> {
  const facts = textToPairs(text(form, 'facts', 2000), 'Highlights');
  const ways = textToPairs(text(form, 'ways', 6000), 'Ways to partner');
  const errors = [...facts.errors, ...ways.errors];
  const title = text(form, 'title', 160);
  if (!title) errors.push('Headline is required');
  if (!ways.pairs.length) errors.push('Add at least one way to partner');
  if (errors.length) return { errors };
  const pg: PartnersPage = { eyebrow: text(form, 'eyebrow', 40), title, intro: text(form, 'intro', 800), facts: facts.pairs.slice(0, 6), ways: ways.pairs.slice(0, 8) };
  return (await store('partners', pg)) ?? { ok: 'Saved. The Partners page is updated.' };
}

export async function resetPolicy(slug: string): Promise<SaveResult> {
  if (!isPolicySlug(slug) && slug !== 'partners') return { errors: ['Unknown page'] };
  return (await store(slug, null)) ?? { ok: 'Back to the built-in text.' };
}

export async function restoreVersion(id: number): Promise<SaveResult> {
  const { supabase } = await requireStaff();
  const { data: v } = await supabase.from('policy_versions').select('slug, value').eq('id', id).maybeSingle();
  if (!v) return { errors: ['Version not found'] };
  return (await store(v.slug, v.value)) ?? { ok: 'Restored that version.' };
}
