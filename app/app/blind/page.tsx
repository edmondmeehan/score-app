import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { BLIND_QUESTIONS, type Answers } from '@/lib/blind';
import { newBlindRound, saveBlindAnswers } from './actions';

export const dynamic = 'force-dynamic';

type Row = { id: string; score: number; created_at: string; started_by_me: boolean; my_choice: string | null; matched: boolean; conversation_id: string | null };

export default async function Blind({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; edit?: string; play?: string }> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const [{ data: a }, { data: inbox }] = await Promise.all([
    supabase.from('compat_answers').select('answers').eq('user_id', me.id).maybeSingle(),
    supabase.rpc('blind_inbox'),
  ]);
  const answers = (a?.answers || null) as Answers | null;
  const rows = (inbox as Row[]) || [];
  const waiting = rows.filter((r) => !r.my_choice);

  if (!answers || sp.edit) {
    return (
      <form action={saveBlindAnswers} className="phone">
        <div className="row"><Link href="/app" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link><span className="eyebrow">Blind round</span></div>
        <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.05 }}>Hot or Financially Compatible?</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>Answer five quick money questions. You’ll see how compatible you are with someone before you see their photos. Then you both decide.</p>
        {sp.error && <div className="notice error">{sp.error}</div>}
        {BLIND_QUESTIONS.map((q, i) => (
          <fieldset key={q.k} className="card stack" style={{ gap: 8, border: '1px solid var(--line-soft)' }}>
            <legend className="label" style={{ padding: 0 }}>{i + 1} of 5</legend>
            <strong style={{ lineHeight: 1.35 }}>{q.q}</strong>
            {q.options.map(([v, l]) => (
              <label key={v} className="choice"><input type="radio" name={q.k} value={v} required defaultChecked={answers?.[q.k] === v} style={{ accentColor: 'var(--gold)' }} data-haptic="selection" />{l}</label>
            ))}
          </fieldset>
        ))}
        <input type="hidden" name="then" value={answers ? 'save' : 'play'} />
        <button className="btn block" data-haptic="medium">{answers ? 'Save answers' : 'See who you’re compatible with'}</button>
        <span className="small muted">Your answers are only shown to people you play a round with. The percentage is just for fun, based on these five answers.</span>
      </form>
    );
  }

  return (
    <div className="phone">
      <div className="row"><Link href="/app" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link><span className="eyebrow">Blind round</span></div>
      <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.05 }}>Hot or Financially Compatible?</h1>
      {sp.error && <div className="notice error">{sp.error}</div>}
      {sp.saved && <div className="notice">Answers saved.</div>}
      <form action={newBlindRound}><button className="btn block" data-haptic="medium">Start a new round</button></form>
      <span className="small muted">Money compatibility first. Photos second. You both choose whether to connect. <Link href="/app/blind?edit=1">Change my answers</Link></span>
      {waiting.length > 0 && <span className="label" style={{ marginTop: 8 }}>Waiting on you</span>}
      {waiting.map((r) => (
        <Link key={r.id} href={`/app/blind/${r.id}`} className="card gold row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="serif" style={{ fontSize: 34, color: 'var(--gold-light)' }}>{r.score}%</span>
          <span className="stack grow" style={{ gap: 2 }}><strong>{r.started_by_me ? 'Your round' : 'Someone played a round with you'}</strong><span className="small muted">Tap to see answers and reveal photos</span></span>
          <span style={{ color: 'var(--gold)' }}>→</span>
        </Link>
      ))}
      {rows.filter((r) => r.my_choice).length > 0 && <span className="label" style={{ marginTop: 8 }}>Played</span>}
      {rows.filter((r) => r.my_choice).map((r) => (
        <Link key={r.id} href={r.matched && r.conversation_id ? `/app/messages/${r.conversation_id}` : `/app/blind/${r.id}`} className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="serif" style={{ fontSize: 26 }}>{r.score}%</span>
          <span className="grow small muted">{r.matched ? 'It’s a match. Open chat' : r.my_choice === 'pass' ? 'You passed' : 'Waiting for them'}</span>
        </Link>
      ))}
    </div>
  );
}
