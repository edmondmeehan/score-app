import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { KIND_LABEL, day, host, type Post } from '@/lib/content';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireMember();
  const { data } = await supabase.from('content_posts').select('*').eq('id', id).maybeSingle();
  const p = data as Post | null;
  if (!p) notFound();
  const back = p.kind === 'dating_tip' ? '/app/discover?tips=dating_tip' : '/app/discover';
  return (
    <div className="phone">
      <div className="row appbar">
        <Link href={back} aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link>
        <span className="label">{KIND_LABEL[p.kind]}</span>
      </div>
      {p.partner_name && <span className="eyebrow">{p.partner_name}</span>}
      <h1 className="serif" style={{ fontSize: 34, lineHeight: 1.1 }}>{p.title}</h1>
      {p.kind === 'news' && <span className="label">{p.source_name || host(p.url)} · {day(p.published_at)}</span>}
      {p.body && <div style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{p.body}</div>}
      {p.perk_code && (
        <div className="card gold stack" style={{ gap: 6, alignItems: 'center', textAlign: 'center' }}>
          <span className="label">Show or enter this code</span>
          <span className="mono" style={{ fontSize: 26, color: 'var(--gold-light)', letterSpacing: '.1em' }}>{p.perk_code}</span>
        </div>
      )}
      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn block">{p.kind === 'news' ? `Read on ${p.source_name || host(p.url)}` : p.kind === 'perk' ? 'Get the perk' : 'Learn more'}</a>}
      {p.kind === 'credit_tip' && <span className="small muted">General education, not financial, legal or tax advice. Your situation may be different.</span>}
    </div>
  );
}
