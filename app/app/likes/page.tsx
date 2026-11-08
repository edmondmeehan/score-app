import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { photoUrls } from '@/lib/photos';
import { BandPill, age } from '@/components/ui';
import type { Band } from '@/lib/types';
import { likeMember } from './actions';

export const dynamic = 'force-dynamic';

type Person = { id: string; first_name: string | null; birth_year: number | null; band: Band | null; neighborhood: string | null; liked_at: string };

export default async function Likes({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireMember();
  const { data } = await supabase.rpc('likes_me');
  const r = (data as { locked: boolean; count: number; people?: Person[] }) || { locked: true, count: 0 };
  const people = r.people || [];
  const photos = await photoUrls(supabase, people.map((p) => p.id));
  return (
    <div className="phone">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row"><Link href="/app" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link><span className="eyebrow">Likes</span></div>
        <Link href="/app/views" className="small">Who viewed me →</Link>
      </div>
      <h1 className="serif" style={{ fontSize: 38 }}>{r.count ? `${r.count} ${r.count === 1 ? 'person likes' : 'people like'} you` : 'No new likes yet'}</h1>
      {sp.error && <div className="notice error">{sp.error}</div>}
      {r.locked ? (
        <div className="card gold stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 8 }}>{Array.from({ length: Math.min(4, Math.max(1, r.count)) }).map((_, i) => <div key={i} className="photo" style={{ width: 64, filter: 'blur(10px)', opacity: .7 }}><span className="serif">?</span></div>)}</div>
          <strong>See who likes you with Premium</strong>
          <span className="small muted">Premium shows everyone who liked you, so you can like them back and start talking right away.</span>
          <Link href="/plans" className="btn block">See Premium</Link>
        </div>
      ) : people.length === 0 ? (
        <span className="small muted">When someone likes your profile, they’ll show up here. Like them back to match.</span>
      ) : people.map((p) => (
        <div key={p.id} className="card row" style={{ padding: 12, gap: 12 }}>
          <Link href={`/app/u/${p.id}`} className="photo" style={{ width: 72, flex: 'none' }}>{photos[p.id]?.[0] ? <img src={photos[p.id][0]} alt="" /> : <span className="serif">{p.first_name?.[0]}</span>}</Link>
          <Link href={`/app/u/${p.id}`} className="stack grow" style={{ gap: 4, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
            <span><strong>{p.first_name}</strong> <span className="muted">{age(p.birth_year)}</span></span>
            <span className="small muted">{p.neighborhood || ''}</span>
            <BandPill band={p.band} />
          </Link>
          <form action={likeMember}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value="/app/likes" /><button className="btn sm" data-haptic="success" aria-label={`Like ${p.first_name} back`}>♥ Like back</button></form>
        </div>
      ))}
    </div>
  );
}
