import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { day, type Story } from '@/lib/content';
import { submitStory } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Stories({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const [{ data }, { data: mine }] = await Promise.all([
    supabase.rpc('approved_stories', { p_limit: 50 }),
    supabase.from('success_stories').select('id, headline, status, created_at').eq('user_id', me.id).order('created_at', { ascending: false }),
  ]);
  const stories = (data as Story[]) || [];
  return (
    <div className="phone">
      <div className="row appbar">
        <Link href="/app/discover" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link>
        <span className="label">Success stories</span>
      </div>
      <h1 className="serif" style={{ fontSize: 40 }}>Met on Score</h1>
      {stories.length === 0 && <div className="notice">No stories yet. Be the first.</div>}
      {stories.map((s) => (
        <article key={s.id} className="card gold stack" style={{ gap: 8 }}>
          <span className="serif" style={{ fontSize: 24 }}>{s.headline}</span>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.story}</p>
          <span className="label">{s.names ? `${s.names} · ` : ''}{day(s.created_at)}</span>
        </article>
      ))}

      <form id="share" action={submitStory} className="card stack" style={{ gap: 14, marginTop: 12 }}>
        <span className="serif" style={{ fontSize: 26 }}>Share your story</span>
        <span className="small muted">We read every one. Nothing is posted until we approve it, and we never show names unless you both say yes.</span>
        {sp.sent && <div className="notice test">Thank you! We&apos;ll let you know if it&apos;s featured.</div>}
        {sp.error && <div className="notice error">{sp.error}</div>}
        <label className="field">Headline<input className="input" name="headline" maxLength={120} placeholder="We met at the supper club" required /></label>
        <label className="field">Your story<textarea className="input" name="story" rows={6} maxLength={2000} placeholder="How you met, your first date, where things are now." required /></label>
        <label className="field">Their first name (optional)<input className="input" name="partner_first_name" maxLength={40} /></label>
        <label className="row small"><input type="checkbox" name="show_names" /> Show our first names</label>
        <label className="row small"><input type="checkbox" name="partner_consent" /> My partner agreed to share this too</label>
        <label className="row small"><input type="checkbox" name="consent" required /> Score can share this story in the app, on its website and on social media. I can ask to remove it any time.</label>
        <button className="btn">Send story</button>
      </form>

      {(mine || []).length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Your submissions</span>
          {(mine || []).map((m) => <span key={m.id} className="small muted">{m.headline} · {m.status === 'approved' ? 'Featured' : m.status === 'rejected' ? 'Not featured' : 'In review'}</span>)}
        </div>
      )}
    </div>
  );
}
