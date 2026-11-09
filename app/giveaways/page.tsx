import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { supabaseServer } from '@/lib/supabase/server';
import { gday, isOpen, type Giveaway } from '@/lib/giveaways';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Giveaways · ScoreDate', description: 'Free giveaways from ScoreDate. No purchase necessary.' };

export default async function Giveaways() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from('giveaways').select('*').in('status', ['live', 'closed', 'drawn']).order('ends_at', { ascending: false }).limit(20);
  const all = (data as Giveaway[]) || [];
  const open = all.filter(isOpen); const past = all.filter((g) => !isOpen(g));
  return (
    <main>
      <SiteHeader cta={false} />
      <section className="page stack" style={{ gap: 18, padding: '48px 24px', maxWidth: 820 }}>
        <span className="eyebrow">Giveaways</span>
        <h1 className="serif" style={{ fontSize: 'clamp(40px, 7vw, 64px)', lineHeight: 1 }}>Free to enter. Fun to win.</h1>
        <p className="muted">Concert tickets, dinners and more from ScoreDate and our partners. No purchase necessary.</p>
        {open.length === 0 && <div className="card small muted">No giveaways open right now. Check back soon.</div>}
        {open.map((g) => <Card key={g.id} g={g} />)}
        {past.length > 0 && <><span className="label" style={{ marginTop: 16 }}>Past giveaways</span>{past.map((g) => <Card key={g.id} g={g} />)}</>}
      </section>
      <SiteFooter />
    </main>
  );
}

function Card({ g }: { g: Giveaway }) {
  return (
    <Link href={`/giveaways/${g.id}`} className="card row" style={{ gap: 16, textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
      {g.image_url && <img src={g.image_url} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 14, flex: 'none' }} />}
      <span className="stack grow" style={{ gap: 4 }}>
        <span className="serif" style={{ fontSize: 24 }}>{g.title}</span>
        <span className="small muted">{g.prize}</span>
        <span className="small" style={{ color: isOpen(g) ? 'var(--gold-light)' : 'var(--faint)' }}>{isOpen(g) ? `Enter by ${gday(g.ends_at)}` : g.status === 'drawn' ? 'Winners drawn' : 'Closed'}</span>
      </span>
      <span className="muted">›</span>
    </Link>
  );
}
