import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { supabaseServer } from '@/lib/supabase/server';
import { gwhen, isOpen, usd, type Giveaway } from '@/lib/giveaways';
import { enterWeb } from '../actions';

export const dynamic = 'force-dynamic';

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from('giveaways').select('*').eq('id', id).maybeSingle();
  return data as Giveaway | null;
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const g = await load((await params).id);
  return g ? { title: `${g.title} · ScoreDate giveaway`, description: `${g.prize}. Free to enter, no purchase necessary.` } : {};
}

export default async function GiveawayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ entered?: string; error?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const g = await load(id);
  if (!g) notFound();
  const open = isOpen(g);
  return (
    <main>
      <SiteHeader cta={false} />
      <section className="page stack" style={{ gap: 16, padding: '40px 24px', maxWidth: 680 }}>
        <Link href="/giveaways" className="small muted">‹ All giveaways</Link>
        {g.image_url && <img src={g.image_url} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 18 }} />}
        <span className="eyebrow">Giveaway{g.partner ? ` · with ${g.partner}` : ''}</span>
        <h1 className="serif" style={{ fontSize: 'clamp(36px, 7vw, 56px)', lineHeight: 1.02 }}>{g.title}</h1>
        <div className="card stack" style={{ gap: 4 }}>
          <span className="label">The prize</span>
          <span style={{ fontSize: 18 }}>{g.prize}</span>
          <span className="small muted">{g.winners_count} winner{g.winners_count === 1 ? '' : 's'} · approx. value {usd(Number(g.prize_value_usd))}{g.winners_count > 1 ? ' each' : ''}</span>
        </div>
        {g.description && <p className="muted" style={{ lineHeight: 1.6 }}>{g.description}</p>}
        <span className="small muted">{open ? `Ends ${gwhen(g.ends_at)}.` : g.status === 'drawn' ? 'This giveaway has ended and winners have been drawn.' : 'This giveaway is closed.'}</span>

        {sp.entered ? (
          <div className="notice">You’re in. Good luck! Winners are drawn within 7 days after it ends and notified by email.</div>
        ) : open ? (
          <form action={enterWeb} className="card stack" style={{ gap: 12 }}>
            <strong>Enter for free</strong>
            {sp.error && <div className="notice error">{sp.error}</div>}
            <input type="hidden" name="id" value={g.id} />
            <label className="field">First name<input className="input" name="first" required maxLength={60} autoComplete="given-name" /></label>
            <label className="field">Email<input className="input" name="email" type="email" required autoComplete="email" autoCapitalize="none" /></label>
            <label className="field">ZIP code<input className="input" name="zip" inputMode="numeric" pattern="\d{5}" required maxLength={5} autoComplete="postal-code" /></label>
            <label className="row small" style={{ gap: 10 }}><input type="checkbox" name="age" required style={{ width: 18, height: 18, accentColor: 'var(--gold)' }} />I’m 25 or older and agree to the <Link href={`/giveaways/${g.id}/rules`}>official rules</Link>.</label>
            <input type="text" name="website_confirm" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} />
            <button className="btn block">Enter giveaway</button>
            <span className="small muted">No purchase necessary. Members can also enter in the ScoreDate app. One entry form per person.</span>
          </form>
        ) : null}
        <span className="small muted">{g.eligibility} Sponsored by ScoreDate, LLC. Apple is not a sponsor and is not involved. <Link href={`/giveaways/${g.id}/rules`}>Official rules</Link></span>
      </section>
      <SiteFooter />
    </main>
  );
}
