'use client';
import { useState } from 'react';
import { answerDeeper } from '../../actions';

export type DeeperState = { unlocked: boolean; current?: { id: number; level: number; q: string; mine: string | null; they_answered: boolean } | null; revealed?: { q: string; level: number; mine: string; theirs: string }[] } | null;
const LEVEL = ['', 'Getting to know you', 'Going deeper', 'Closer'];

/** Questions that get a little more personal over time. Each answer stays hidden until both of you have answered. */
export default function DeeperCard({ conversationId, otherName, initial }: { conversationId: string; otherName: string; initial: DeeperState }) {
  const [st, setSt] = useState<DeeperState>(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!st?.unlocked) return null;
  const cur = st.current;
  const revealed = st.revealed || [];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cur || !text.trim()) return;
    setBusy(true); setErr(null);
    const r = await answerDeeper(conversationId, cur.id, text);
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'Could not save'); return; }
    setText(''); setSt(r.state as DeeperState);
  }
  return (
    <details id="deeper" className="card stack" style={{ gap: 10 }} open={Boolean(cur && !cur.mine)}>
      <summary className="row" style={{ justifyContent: 'space-between', cursor: 'pointer', listStyle: 'none' }}>
        <span className="stack" style={{ gap: 2 }}><span className="label">Go deeper</span><span className="small muted">{cur ? LEVEL[cur.level] : 'All answered'} · answers show when you’ve both replied</span></span>
        <span className="small muted">{revealed.length} shared</span>
      </summary>
      {cur && (
        cur.mine ? (
          <div className="stack" style={{ gap: 6 }}>
            <span className="serif" style={{ fontSize: 19, lineHeight: 1.3 }}>{cur.q}</span>
            <div className="deeper-a">{cur.mine}</div>
            <span className="small muted">Waiting for {otherName}. You’ll both see each other’s answer once they reply.</span>
          </div>
        ) : (
          <form onSubmit={submit} className="stack" style={{ gap: 8 }}>
            <span className="serif" style={{ fontSize: 19, lineHeight: 1.3 }}>{cur.q}</span>
            {cur.they_answered && <span className="small" style={{ color: 'var(--gold-light)' }}>{otherName} has answered. Reply to see it.</span>}
            <textarea className="input" rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder="Take your time. Skip it if it’s not for you." />
            <div className="row" style={{ gap: 8 }}><button className="btn sm" disabled={busy || !text.trim()} data-haptic="success">{busy ? 'Saving…' : 'Answer'}</button></div>
            {err && <div className="notice error">{err}</div>}
          </form>
        )
      )}
      {revealed.length > 0 && (
        <div className="stack" style={{ gap: 10 }}>
          {[...revealed].reverse().map((r) => (
            <div key={r.q} className="stack" style={{ gap: 4 }}>
              <span className="small muted">{r.q}</span>
              <div className="deeper-a"><strong>You:</strong> {r.mine}</div>
              <div className="deeper-a"><strong>{otherName}:</strong> {r.theirs}</div>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
