import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { Steps } from '@/components/ui';
import { MONEY_QUESTIONS } from '@/lib/types';
import { saveQuiz } from '../actions';

export default async function Quiz({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { me } = await getMe();
  if (!me) redirect('/signin');
  const sp = await searchParams;
  return (
    <form action={saveQuiz} className="phone">
      <Steps at={4} />
      <span className="eyebrow">Money values</span>
      <h1 className="serif" style={{ fontSize: 38 }}>How you think about money</h1>
      <p className="muted" style={{ margin: 0 }}>Each answer shows on your profile as a chip. No wrong answers.</p>
      {MONEY_QUESTIONS.map((q) => (
        <fieldset key={q.id} className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
          <legend style={{ fontWeight: 600, marginBottom: 8 }}>{q.q}</legend>
          {q.options.map((o) => (
            <label key={o} className="choice"><input type="radio" name={q.id} value={o} defaultChecked={me.money_values?.includes(o)} style={{ accentColor: 'var(--gold)' }} />{o}</label>
          ))}
        </fieldset>
      ))}
      <label className="field">Your money prompt
        <select className="input" name="prompt_q" defaultValue={me.prompt_q || ''}>
          <option>Best purchase I ever made…</option><option>My financial red flag is…</option><option>The splurge I never regret…</option><option>Money lesson my parents taught me…</option>
        </select>
      </label>
      <label className="field">Your answer<textarea className="input" name="prompt_a" rows={3} maxLength={160} defaultValue={me.prompt_a || ''} /></label>
      {sp.error && <div className="notice error">{sp.error}</div>}
      <button className="btn block">Continue</button>
    </form>
  );
}
