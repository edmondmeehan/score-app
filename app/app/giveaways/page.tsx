import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { gday, isOpen, type Giveaway } from '@/lib/giveaways';
import GiveawayCard from '../discover/GiveawayCard';
import NewWindowLink from '@/components/NewWindowLink';

export const dynamic = 'force-dynamic';

export default async function AppGiveaways() {
  const { supabase } = await requireMember();
  const { data } = await supabase.from('giveaways').select('*').in('status', ['live', 'closed', 'drawn']).order('ends_at', { ascending: false }).limit(20);
  const all = (data as Giveaway[]) || [];
  const open = all.filter(isOpen); const past = all.filter((g) => !isOpen(g)).slice(0, 6);
  const mine = await Promise.all(open.map((g) => supabase.rpc('my_giveaway', { p_g: g.id }).then((r) => r.data as { entered: boolean; entries: number } | null)));
  return (
    <div className="phone">
      <span className="eyebrow">Free to enter</span>
      <h1 className="serif" style={{ fontSize: 40 }}>Giveaways</h1>
      <span className="small muted">Concert tickets, dinners and more. No purchase necessary. Get bonus entries for a complete profile and for friends who join with your invite.</span>
      {open.length === 0 ? <div className="notice">No giveaways open right now. We’ll let you know when the next one starts.</div>
        : open.map((g, i) => <GiveawayCard key={g.id} g={g} mine={mine[i]} />)}
      <Link href="/app/invites" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}><span className="grow">Invite a friend <span className="small muted">· +1 entry each when they join</span></span><span className="muted">›</span></Link>
      {past.length > 0 && (
        <section className="stack" style={{ gap: 8, marginTop: 8 }}>
          <span className="label">Past giveaways</span>
          {past.map((g) => (
            <div key={g.id} className="card row" style={{ gap: 12 }}>
              <span className="stack grow" style={{ gap: 2 }}><strong>{g.title}</strong><span className="small muted">{g.prize} · ended {gday(g.ends_at)}{g.status === 'drawn' ? ' · winners drawn' : ''}</span></span>
              <NewWindowLink href={`/giveaways/${g.id}/rules`} className="small">Rules</NewWindowLink>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
