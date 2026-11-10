import { supabaseServer } from '@/lib/supabase/server';
import NewWindowLink from '@/components/NewWindowLink';

type Partner = { slug: string; name: string; tagline: string | null; score_type: string | null; badge: string | null };

/** Free credit-score services (Admin → Credit partners). Links go through /go/<slug> so clicks are counted. */
export default async function CreditPartners({ placement }: { placement: string }) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from('credit_partners').select('slug, name, tagline, score_type, badge').eq('active', true).order('sort');
  const list = (data as Partner[]) || [];
  if (!list.length) return null;
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <span className="label">Don’t know your score? Check it free</span>
      {list.map((p) => (
        <NewWindowLink key={p.slug} href={`/go/${p.slug}?from=${placement}`} className="partner-row">
          <span className="stack grow" style={{ gap: 2 }}>
            <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}><strong>{p.name}</strong>{p.badge && <span className="chip small" style={{ borderColor: 'var(--gold-edge)', color: 'var(--gold-light)' }}>{p.badge}</span>}</span>
            {p.tagline && <span className="small muted">{p.tagline}</span>}
            {p.score_type && <span className="small" style={{ color: 'var(--faint)' }}>{p.score_type}</span>}
          </span>
          <span className="small" style={{ color: 'var(--gold-light)', whiteSpace: 'nowrap' }}>Check free ›</span>
        </NewWindowLink>
      ))}
      <span className="small muted">Free, and checking doesn’t affect your credit. ScoreDate may earn a commission if you sign up, at no cost to you. We never see your score or share your information with these services.</span>
    </div>
  );
}
