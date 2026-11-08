import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { photoUrls } from '@/lib/photos';
import { BANDS, type Band } from '@/lib/types';
import { BLIND_QUESTIONS, answerLabel, type BlindRound } from '@/lib/blind';
import { chooseBlind, revealBlind } from '../actions';
import ShareCompat from './ShareCompat';
import HapticOnMount from '@/components/HapticOnMount';
import ScreenshotContext from '@/components/ScreenshotContext';

export const dynamic = 'force-dynamic';

export default async function BlindRoundPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; matched?: string; revealed?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const { data } = await supabase.rpc('blind_round', { p_id: id });
  const r = data as BlindRound | null;
  if (!r) notFound();
  const photo = r.other ? (await photoUrls(supabase, [r.other.id]))[r.other.id]?.[0] : null;
  const band = r.hint.band ? BANDS[r.hint.band as Band] : null;
  const same = BLIND_QUESTIONS.filter((q) => r.mine?.[q.k] && r.mine?.[q.k] === r.theirs?.[q.k]).length;

  return (
    <div className="phone">
      <ScreenshotContext context="blind" target={r.other?.id ?? null} />
      {sp.matched && <HapticOnMount kind="success" />}
      {sp.revealed && <HapticOnMount kind="medium" />}
      <div className="row"><Link href="/app/blind" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link><span className="eyebrow">Blind round</span></div>
      {sp.error && <div className="notice error">{sp.error}</div>}

      <div className="card gold stack" style={{ alignItems: 'center', textAlign: 'center', gap: 6, padding: '28px 18px' }}>
        <span className="label">Financial compatibility</span>
        <span className="serif" style={{ fontSize: 96, lineHeight: 1, color: 'var(--gold-light)' }}>{r.score}%</span>
        <span className="small muted">{same} of 5 answers match{r.hint.age ? ` · ${r.hint.age}` : ''}{band ? ` · ${band.label} band` : ''}</span>
        <span className="small muted" style={{ fontSize: 11 }}>Just for fun, based on your five answers.</span>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        {BLIND_QUESTIONS.map((q) => {
          const match = r.mine?.[q.k] && r.mine?.[q.k] === r.theirs?.[q.k];
          return (
            <div key={q.k} className="stack" style={{ gap: 4, borderBottom: '1px solid var(--line-soft)', paddingBottom: 10 }}>
              <span className="small muted">{q.q}</span>
              <div className="row small" style={{ justifyContent: 'space-between', gap: 10 }}>
                <span>You: <strong>{answerLabel(q.k, r.mine?.[q.k])}</strong></span>
                <span style={{ color: match ? 'var(--rise)' : undefined }}>{r.other?.first_name || 'Them'}: <strong>{answerLabel(q.k, r.theirs?.[q.k])}</strong>{match ? ' ✓' : ''}</span>
              </div>
            </div>
          );
        })}
      </div>

      {!r.revealed ? (
        <form action={revealBlind}>
          <input type="hidden" name="id" value={r.id} />
          <button className="btn block" data-haptic="medium">Now let’s see if there’s chemistry</button>
        </form>
      ) : (
        <>
          <Link href={`/app/u/${r.other!.id}`} className="card row" style={{ textDecoration: 'none', color: 'inherit', gap: 14 }}>
            <div className="photo" style={{ width: 96, flex: 'none' }}>{photo ? <img src={photo} alt="" /> : <span className="serif">{r.other?.first_name?.[0]}</span>}</div>
            <div className="stack grow" style={{ gap: 4 }}>
              <span className="serif" style={{ fontSize: 28 }}>{r.other?.first_name}</span>
              <span className="small muted">{[r.other?.job, r.other?.neighborhood].filter(Boolean).join(' · ')}</span>
              <span className="small" style={{ color: 'var(--gold)' }}>See full profile →</span>
            </div>
          </Link>
          {r.matched ? (
            <div className="card gold stack" style={{ textAlign: 'center', gap: 10 }}>
              <span className="serif" style={{ fontSize: 30 }}>It’s mutual.</span>
              <span className="small muted">You both want to connect.</span>
              {r.conversation_id && <Link className="btn block" href={`/app/messages/${r.conversation_id}`}>Say hello</Link>}
            </div>
          ) : r.my_choice === 'pass' ? (
            <div className="notice">You passed on this one.</div>
          ) : r.my_choice === 'connect' ? (
            <div className="notice">{r.they_passed ? 'Not this time. There are more rounds to play.' : 'You want to connect. We’ll let you know if they do too.'}</div>
          ) : (
            <div className="row" style={{ gap: 10 }}>
              <form action={chooseBlind} className="grow"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="choice" value="pass" /><button className="btn ghost block" data-haptic="light">Pass</button></form>
              <form action={chooseBlind} className="grow"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="choice" value="connect" />
                {me.plan === 'preview' ? <Link href="/plans" className="btn block">Become a member to connect</Link> : <button className="btn block" data-haptic="medium">Connect</button>}
              </form>
            </div>
          )}
        </>
      )}
      <ShareCompat score={r.score} />
      <Link href="/app/blind" className="small muted">Play another round</Link>
    </div>
  );
}
