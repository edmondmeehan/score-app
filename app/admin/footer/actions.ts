'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireStaff } from '@/lib/session';
import { MAX_COLUMNS, parseLinks, REQUIRED_LINKS, type FooterColumn, type FooterConfig } from '@/lib/footer';

export type SaveResult = { ok?: string; errors?: string[] };

const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').replace(/\r/g, '').trim().slice(0, max);

export async function saveFooter(form: FormData): Promise<SaveResult> {
  const { supabase } = await requireStaff();
  const errors: string[] = [];

  const columns: FooterColumn[] = [];
  for (let i = 0; i < MAX_COLUMNS; i++) {
    const title = text(form, `col${i}_title`, 40);
    const parsed = parseLinks(text(form, `col${i}_links`, 4000));
    errors.push(...parsed.errors.map((e) => `Column ${i + 1}: ${e}`));
    if (!title && parsed.links.length === 0) continue;
    if (!title) { errors.push(`Column ${i + 1} needs a heading`); continue; }
    if (parsed.links.length === 0) { errors.push(`“${title}” needs at least one link`); continue; }
    if (parsed.links.length > 12) errors.push(`“${title}” can have up to 12 links`);
    columns.push({ title, links: parsed.links });
  }
  const app = parseLinks(text(form, 'app_links', 2000));
  errors.push(...app.errors.map((e) => `In-app footer: ${e}`));

  const email = text(form, 'email', 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Support email doesn’t look right');

  const footer: FooterConfig = {
    tagline: text(form, 'tagline', 300),
    company: text(form, 'company', 120),
    address: text(form, 'address', 300),
    email,
    columns,
    copyright: text(form, 'copyright', 300),
    disclaimer: text(form, 'disclaimer', 1200),
    app_links: app.links,
  };

  // Guard rails: these keep the app in line with App Store rules and privacy law.
  const siteHrefs = columns.flatMap((c) => c.links.map((l) => l.href));
  for (const r of [...REQUIRED_LINKS, { label: 'Your privacy choices', href: '/legal/choices' }]) {
    if (!siteHrefs.includes(r.href)) errors.push(`Site footer must keep a link to ${r.label} (${r.href})`);
  }
  for (const r of REQUIRED_LINKS) {
    if (!footer.app_links.some((l) => l.href === r.href)) errors.push(`In-app footer must keep a link to ${r.label} (${r.href})`);
  }
  if (!footer.disclaimer) errors.push('Keep the credit disclaimer. It tells people ScoreDate isn’t a lender or credit bureau.');
  if (!footer.company) errors.push('Company name is required');
  if (columns.length === 0) errors.push('Add at least one link column');

  if (errors.length) return { errors };

  const { error } = await supabase.rpc('staff_set_footer', { p_footer: footer });
  if (error) return { errors: [/function|does not exist|schema cache/i.test(error.message) ? 'Run migration 0020 in the ScoreDate SQL Editor first.' : error.message] };
  revalidateTag('footer');
  revalidatePath('/', 'layout');
  return { ok: 'Saved. The footer is updated across the site and app.' };
}

export async function resetFooter(): Promise<SaveResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('staff_set_footer', { p_footer: null });
  if (error) return { errors: [/function|does not exist|schema cache/i.test(error.message) ? 'Run migration 0020 in the ScoreDate SQL Editor first.' : error.message] };
  revalidateTag('footer');
  revalidatePath('/', 'layout');
  return { ok: 'Footer reset to the default.' };
}
