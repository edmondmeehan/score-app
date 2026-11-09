import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { DOCS } from '@/lib/docs';
import { docToText, isPolicySlug, mergeDoc, mergePartners, pairsToText } from '@/lib/policies';
import PolicyEditor, { PartnersEditor, VersionList } from './PolicyEditor';

export const dynamic = 'force-dynamic';

export default async function EditPolicy({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isPolicySlug(slug) && slug !== 'partners') notFound();
  const { supabase } = await requireStaff();
  const [{ data: role }, { data: row }, { data: versions }] = await Promise.all([
    supabase.rpc('staff_role'),
    supabase.from('app_config').select('value').eq('key', `doc:${slug}`).maybeSingle(),
    supabase.from('policy_versions').select('id, value, staff_email, created_at').eq('slug', slug).order('created_at', { ascending: false }).limit(15),
  ]);
  const owner = role === 'owner';
  const href = slug === 'partners' ? '/partners' : `/legal/${slug}`;
  const vs = (versions || []).map((v, i) => ({ id: v.id as number, at: v.created_at as string, by: (v.staff_email as string | null) || null, reset: v.value == null, current: i === 0 }));

  let editor;
  if (slug === 'partners') {
    const p = mergePartners(row?.value);
    editor = <PartnersEditor owner={owner} custom={p.custom} initial={{ eyebrow: p.eyebrow, title: p.title, intro: p.intro, facts: pairsToText(p.facts), ways: pairsToText(p.ways) }} />;
  } else {
    const d = mergeDoc(slug, row?.value);
    const saved = row?.value as { body?: string } | null;
    editor = <PolicyEditor owner={owner} custom={d.custom} slug={slug} initial={{ title: d.title, summary: d.summary, updated: d.updated, draft: Boolean(d.draft), body: saved?.body ?? docToText(DOCS[slug].sections) }} />;
  }
  return (
    <>
      <Link href="/admin/policies" className="small muted">‹ All policies</Link>
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="serif" style={{ fontSize: 40 }}>{slug === 'partners' ? 'Partners page' : DOCS[slug].title}</h1>
        <a href={href} target="_blank" rel="noopener noreferrer" className="btn ghost sm">View live ↗</a>
      </div>
      {!owner && <div className="notice">Only owners can save changes.</div>}
      {editor}
      <VersionList versions={vs} owner={owner} />
    </>
  );
}
