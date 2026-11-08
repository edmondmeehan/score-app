import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { when, type EventRow } from '@/lib/events';
import { day, host, type Post, type Story } from '@/lib/content';
import AppFooter from '@/components/AppFooter';

export const dynamic = 'force-dynamic';

const TABS = [['credit_tip', 'Credit'], ['dating_tip', 'Dating']] as const;

export default async function Discover({ searchParams }: { searchParams: Promise<{ tips?: string }> }) {
  const sp = await searchParams;
  const tipKind = sp.tips === 'dating_tip' ? 'dating_tip' : 'credit_tip';
  const { supabase } = await requireMember();
  const since = new Date(Date.now() - 6 * 3600000).toISOString();
  const [{ data: events }, { data: tips }, { data: news }, { data: perks }, { data: stories }] = await Promise.all([
    supabase.from('events').select('*').eq('status', 'published').gte('starts_at', since).order('starts_at').limit(3),
    supabase.from('content_posts').select('*').eq('kind', tipKind).eq('status', 'published').order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(4),
    supabase.from('content_posts').select('*').eq('kind', 'news').eq('status', 'published').order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(5),
    supabase.from('content_posts').select('*').eq('kind', 'perk').eq('status', 'published').order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(6),
    supabase.rpc('approved_stories', { p_limit: 3 }),
  ]);
  const ev = (events as EventRow[]) || [];
  const st = (stories as Story[]) || [];
  return (
    <div className="phone">
      <span className="eyebrow">Members only</span>
      <h1 className="serif" style={{ fontSize: 40 }}>Discover</h1>

      <Section title="Upcoming events" more={{ href: '/app/events', label: 'All events' }}>
        {ev.length === 0 ? <Empty text="Nothing on the calendar yet. We'll email you when the next one opens." /> : ev.map((e) => (
          <Link key={e.id} href={`/app/events/${e.id}`} className="card stack" style={{ textDecoration: 'none', color: 'inherit', gap: 6 }}>
            <span className="mono small" style={{ color: 'var(--gold-light)' }}>{when(e.starts_at)}</span>
            <span className="serif" style={{ fontSize: 22 }}>{e.title}</span>
            <span className="small muted">{e.venue}{e.price_note ? ` · ${e.price_note}` : ''}</span>
          </Link>
        ))}
      </Section>

      <Section title="Tips">
        <div className="row" style={{ gap: 8 }}>
          {TABS.map(([k, label]) => <Link key={k} href={`/app/discover?tips=${k}`} scroll={false} className={tipKind === k ? 'btn sm' : 'btn ghost sm'}>{label}</Link>)}
        </div>
        {((tips as Post[]) || []).map((t) => (
          <Link key={t.id} href={`/app/discover/${t.id}`} className="card stack" style={{ textDecoration: 'none', color: 'inherit', gap: 6 }}>
            <strong style={{ fontSize: 16 }}>{t.title}</strong>
            <span className="small muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.body}</span>
          </Link>
        ))}
        {tipKind === 'credit_tip' && <span className="small muted">General education, not financial advice.</span>}
      </Section>

      <Section title="In the news">
        {((news as Post[]) || []).length === 0 ? <Empty text="We post the best dating and credit stories here every week." /> : ((news as Post[]) || []).map((n) => (
          <Link key={n.id} href={`/app/discover/${n.id}`} className="list-row">
            <span className="stack grow" style={{ gap: 4 }}>
              <span className="label">{n.source_name || host(n.url)} · {day(n.published_at)}</span>
              <span style={{ fontSize: 15 }}>{n.title}</span>
            </span>
            <span className="muted" aria-hidden="true">›</span>
          </Link>
        ))}
      </Section>

      <Section title="Success stories" more={{ href: '/app/discover/stories', label: st.length ? 'All stories' : 'Share yours' }}>
        {st.length === 0 ? (
          <div className="card stack" style={{ gap: 10 }}>
            <span className="serif" style={{ fontSize: 22 }}>Met someone on ScoreDate?</span>
            <span className="small muted">Tell us how it happened. We only share stories with your permission.</span>
            <Link href="/app/discover/stories#share" className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>Share your story</Link>
          </div>
        ) : st.map((s) => (
          <div key={s.id} className="card gold stack" style={{ gap: 8 }}>
            <span className="serif" style={{ fontSize: 22 }}>{s.headline}</span>
            <span className="small muted" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.story}</span>
            {s.names && <span className="label">{s.names}</span>}
          </div>
        ))}
      </Section>

      <Section title="Partner perks">
        {((perks as Post[]) || []).length === 0 ? <Empty text="Member perks from restaurants, bars and brands we love are coming soon." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {((perks as Post[]) || []).map((p) => (
              <Link key={p.id} href={`/app/discover/${p.id}`} className="card stack" style={{ textDecoration: 'none', color: 'inherit', gap: 6, padding: 14 }}>
                <span className="label">{p.partner_name}</span>
                <span style={{ fontSize: 15 }}>{p.title}</span>
              </Link>
            ))}
          </div>
        )}
        <Link href="/partners" className="small">Own a venue or brand? Partner with ScoreDate</Link>
      </Section>
      <AppFooter />
    </div>
  );
}

function Section({ title, more, children }: { title: string; more?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ gap: 12, marginTop: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="serif" style={{ fontSize: 26 }}>{title}</h2>
        {more && <Link href={more.href} className="small">{more.label}</Link>}
      </div>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="notice">{text}</div>;
}
