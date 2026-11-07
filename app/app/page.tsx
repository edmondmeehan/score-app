import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { BandPill, age } from '@/components/ui';
import { photoUrls } from '@/lib/photos';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Drop() {
  const { supabase, me } = await requireMember();
  if (me.status === 'paused' || me.status === 'taken') {
    return (
      <div className="phone" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <h1 className="serif" style={{ fontSize: 36 }}>{me.status === 'taken' ? 'Matched on Score' : 'You’re paused'}</h1>
        <p className="muted">You’re hidden from matching. Your chats and friends are still here.</p>
        <Link className="btn block" href="/app/settings">Change status</Link>
      </div>
    );
  }
  const { data: drop } = await supabase.rpc('get_drop');
  const ids = (drop || []).map((d: { match_id: string }) => d.match_id);
  const { data: people } = ids.length ? await supabase.from('profiles').select('*').in('id', ids) : { data: [] };
  const byId = Object.fromEntries((people || []).map((p: Profile) => [p.id, p]));
  const photos = await photoUrls(supabase, ids);
  const preview = me.plan === 'preview';
  const daysLeft = me.preview_ends_at ? Math.max(0, Math.ceil((new Date(me.preview_ends_at).getTime() - Date.now()) / 86400000)) : null;
  return (
    <div className="phone">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">{preview ? 'Preview' : 'Tonight · 7pm'}</span>
        {preview && daysLeft !== null && <span className="mono small muted">{daysLeft} days left</span>}
      </div>
      <h1 className="serif" style={{ fontSize: 40 }}>{preview ? 'Your 5 matches' : 'Your Daily Drop'}</h1>
      <span className="muted small">{preview ? 'Look all you want. Members can say hello.' : 'Ranked by money values and preferences'}</span>
      {(drop || []).length === 0 && (
        <div className="card stack" style={{ textAlign: 'center', padding: 32 }}>
          <span className="serif" style={{ fontSize: 26 }}>That&apos;s everyone for now</span>
          <span className="small muted">New members join with every drop. Invite someone you&apos;d vouch for.</span>
          <Link href="/app/invites" className="btn ghost sm">Send an invite</Link>
        </div>
      )}
      <div className="stack">
        {(drop || []).map((d: { match_id: string; compat: number }) => {
          const p = byId[d.match_id];
          if (!p) return null;
          return (
            <Link key={d.match_id} href={`/app/u/${p.id}`} className="card row" style={{ textDecoration: 'none', color: 'var(--ivory)', padding: 12 }}>
              <div className="photo" style={{ width: 76, flex: 'none' }}>{photos[p.id]?.[0] ? <img src={photos[p.id][0]} alt="" /> : <span className="serif">{p.first_name?.[0]}</span>}</div>
              <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
                <span><strong style={{ fontSize: 17 }}>{p.first_name}</strong> <span className="muted">{age(p.birth_year)}</span></span>
                <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.job, p.neighborhood].filter(Boolean).join(' · ')}</span>
                <BandPill band={p.band} trend={p.trend} />
              </div>
              <div className="stack" style={{ alignItems: 'flex-end', gap: 0 }}><span className="serif" style={{ fontSize: 30, color: 'var(--gold-light)' }}>{d.compat}%</span><span className="small muted">match</span></div>
            </Link>
          );
        })}
      </div>
      {preview && <Link className="btn block" href="/plans">Become a member · $24.99/mo</Link>}
    </div>
  );
}
