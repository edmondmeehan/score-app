import { MONEY_QUESTIONS } from '@/lib/types';

const SHORT: Record<string, string> = { style: 'Style', debt: 'Debt', check: 'First date', finances: 'As a couple', goal: '5-year goal', risk: 'Investing' };
const TITLE: Record<string, string> = { Saver: 'The Planner', Spender: 'The Enjoyer', Balanced: 'The Balancer' };

/** A member's money-quiz answers as a styled card, with how many answers they share with the viewer. */
export default function MoneyStyleCard({ name, theirs, mine, isMe }: { name: string; theirs: string[]; mine: string[]; isMe: boolean }) {
  const rows = MONEY_QUESTIONS.map((q) => ({ id: q.id, label: SHORT[q.id] || q.q, answer: q.options.find((o) => theirs.includes(o)) || null }))
    .filter((r) => r.answer);
  if (rows.length === 0) return null;
  const shared = isMe ? 0 : rows.filter((r) => mine.includes(r.answer!)).length;
  const style = rows.find((r) => r.id === 'style')?.answer;
  return (
    <section className="money-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">{isMe ? 'Your money style' : `${name}’s money style`}</span>
          <span className="serif" style={{ fontSize: 30, lineHeight: 1 }}>{(style && TITLE[style]) || 'Money style'}</span>
        </div>
        {!isMe && mine.length > 0 && (
          <div className="money-match" aria-label={`You match on ${shared} of ${rows.length}`}>
            <span className="serif" style={{ fontSize: 26, lineHeight: 1 }}>{shared}<span className="muted" style={{ fontSize: 16 }}>/{rows.length}</span></span>
            <span className="small muted">in common</span>
          </div>
        )}
      </div>
      <div className="money-rows">
        {rows.map((r) => {
          const both = !isMe && mine.includes(r.answer!);
          return (
            <div key={r.id} className={`money-row${both ? ' both' : ''}`}>
              <span className="small muted">{r.label}</span>
              <span className="money-answer">{r.answer}{both && <span className="money-you">You too</span>}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
