import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { photoUrls } from '@/lib/photos';
import { verifiedMap } from '@/lib/bandVerified';
import { BandPill, age } from '@/components/ui';
import type { Band } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Person = { id: string; first_name: string | null; birth_year: number | null; band: Band | null; at: string };
const ago = (s: string) => { const h = Math.round((Date.now() - new Date(s).getTime()) / 3600000); return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };

export default async function Views() {
  const { supabase } = await requireMember();
  const { data } = await supabase.rpc('views_me');
  const r = (data as { locked: boolean; count: number; people?: Person[] }) || { locked: true, count: 0 };
  const people = r.people || [];
  const [photos, vmap] = await Promise.all([photoUrls(supabase, people.map((p) => p.id)), verifiedMap(supabase, people.map((p) => p.id))]);
  return (
    <div className="phone">
      <div className="row"><Link href="/app/likes" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link><span className="eyebrow">Profile views</span></div>
      <h1 className="serif" style={{ fontSize: 38 }}>{r.count} {r.count === 1 ? 'person' : 'people'} viewed you</h1>
      <span className="small muted">Last 30 days. Staff views aren’t counted.</span>
      {r.locked ? (
        <div className="card gold stack" style={{ gap: 10 }}>
          <strong>See who viewed your profile with Premium</strong>
          <span className="small muted">Find out who’s curious, then say hello or like them first.</span>
          <Link href="/plans" className="btn block">See Premium</Link>
        </div>
      ) : people.map((p) => (
        <Link key={p.id} href={`/app/u/${p.id}`} className="card row" style={{ padding: 12, gap: 12, textDecoration: 'none', color: 'inherit' }}>
          <div className="photo" style={{ width: 64, flex: 'none' }}>{photos[p.id]?.[0] ? <img src={photos[p.id][0]} alt="" /> : <span className="serif">{p.first_name?.[0]}</span>}</div>
          <div className="stack grow" style={{ gap: 4 }}><span><strong>{p.first_name}</strong> <span className="muted">{age(p.birth_year)}</span></span><BandPill band={p.band} verified={vmap[p.id]} /></div>
          <span className="small muted">{ago(p.at)}</span>
        </Link>
      ))}
    </div>
  );
}
