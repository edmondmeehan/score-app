import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { DOCS } from '@/lib/docs';
import { POLICY_SLUGS } from '@/lib/policies';

export const dynamic = 'force-dynamic';

export default async function PoliciesAdmin() {
  const { supabase } = await requireStaff();
  const { data: rows } = await supabase.from('app_config').select('key, value').like('key', 'doc:%');
  const { data: last } = await supabase.from('policy_versions').select('slug, staff_email, created_at').order('created_at', { ascending: false }).limit(50);
  const saved = new Map((rows || []).map((r) => [r.key.slice(4), r.value as { updated?: string; draft?: boolean }]));
  const lastBy = new Map<string, { staff_email: string | null; created_at: string }>();
  for (const v of last || []) if (!lastBy.has(v.slug)) lastBy.set(v.slug, v);
  const fmt = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  const items: { slug: string; title: string; href: string }[] = [
    ...POLICY_SLUGS.map((s) => ({ slug: s, title: DOCS[s].title, href: `/legal/${s}` })),
    { slug: 'partners', title: 'Partners page', href: '/partners' },
  ];
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Policies</h1>
      <span className="small muted">Edit Privacy, Terms, Biometric, the other policies and the Partners page. Saves go live within seconds, every version is kept, and changes are in the audit log. Have counsel review material changes before saving.</span>
      <div className="stack" style={{ gap: 10 }}>
        {items.map((it) => {
          const s = saved.get(it.slug); const l = lastBy.get(it.slug);
          return (
            <Link key={it.slug} href={`/admin/policies/${it.slug}`} className="card row" style={{ textDecoration: 'none', color: 'inherit', gap: 12 }}>
              <span className="stack grow" style={{ gap: 4 }}>
                <strong>{it.title}</strong>
                <span className="small muted">
                  {s ? 'Edited' : 'Built-in text'}{s?.updated ? ` · Last updated ${s.updated}` : ''}{s?.draft ? ' · Marked draft' : ''}{l ? ` · saved ${fmt(l.created_at)}${l.staff_email ? ` by ${l.staff_email}` : ''}` : ''}
                </span>
              </span>
              <span className="muted">Edit ›</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
