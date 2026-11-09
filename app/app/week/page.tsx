import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { profileStrength } from '@/lib/profileStrength';

export const dynamic = 'force-dynamic';

type Week = { views: number; likes: number; chats: number; dates: number; best_prompt: { q: string; replies: number } | null };

export default async function WeekRecap() {
  const { supabase, me } = await requireMember();
  const [{ data }, { count: photoCount }] = await Promise.all([
    supabase.rpc('my_week'),
    supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', me.id).neq('match_status', 'rejected'),
  ]);
  const w = (data as Week) || { views: 0, likes: 0, chats: 0, dates: 0, best_prompt: null };
  const s = profileStrength(me, photoCount || 0);
  const tiles: [string, number][] = [['Profile views', w.views], ['New likes', w.likes], ['New chats', w.chats], ['Dates set', w.dates]];
  const tip = s.next ? `${s.next.label}. Profiles at 100% get more replies.`
    : w.chats > 0 && w.dates === 0 ? 'You have chats going. Suggest a date with the one you like most; ScoreDate Partners come with perks.'
    : 'Answer today’s question. Shared answers show up in your chats and make easy openers.';
  return (
    <div className="phone">
      <Link href="/app/settings" className="small">← Me</Link>
      <span className="eyebrow">Last 7 days</span>
      <h1 className="serif" style={{ fontSize: 38 }}>Your week</h1>
      <div className="week-grid">
        {tiles.map(([l, n]) => <div key={l} className="card stack" style={{ gap: 2 }}><span className="serif" style={{ fontSize: 34, color: 'var(--gold-light)' }}>{n}</span><span className="small muted">{l}</span></div>)}
      </div>
      {w.best_prompt && (
        <div className="card stack" style={{ gap: 6 }}>
          <span className="label">Your best prompt</span>
          <span className="serif" style={{ fontSize: 22 }}>{w.best_prompt.q}</span>
          <span className="small muted">{w.best_prompt.replies} {w.best_prompt.replies === 1 ? 'reply' : 'replies'} this month</span>
        </div>
      )}
      <div className="card gold stack" style={{ gap: 6 }}>
        <span className="label">One tip</span>
        <span>{tip}</span>
        {s.next && <Link href={s.next.href} className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>Do it now</Link>}
      </div>
      <span className="small muted">Only you see this. We send a Sunday recap when there’s good news, never a “nobody looked” message.</span>
    </div>
  );
}
