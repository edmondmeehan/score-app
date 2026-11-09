'use client';
import { useState } from 'react';

const STAGES = [
  { title: 'Values', when: 'Easy to start', qs: [
    'What did money feel like in your house growing up?',
    'What’s something you love spending on, no guilt?',
    'Are you more of a planner or a “figure it out later” person with money?',
  ] },
  { title: 'Goals', when: 'When it feels natural', qs: [
    'What’s a big thing you’re saving toward?',
    'What does “comfortable” look like to you in five years?',
    'How do you picture splitting things like trips and dinners as a couple?',
  ] },
  { title: 'Numbers', when: 'Only when you’re both ready', qs: [
    'Is there anything money-wise you’d want a partner to know early, like student loans or a big goal?',
    'How would you want to handle shared costs if we moved in together someday?',
  ] },
];

/** A gentle, stage-by-stage guide for talking about money, unlocked after a couple of dates. Taps put the question in the message box to edit. */
export default function MoneyTalk({ otherName }: { otherName: string }) {
  const [stage, setStage] = useState(0);
  const s = STAGES[stage];
  const use = (q: string) => window.dispatchEvent(new CustomEvent('sd:compose', { detail: { text: q } }));
  return (
    <details className="card stack money-talk" style={{ gap: 10 }}>
      <summary className="stack" style={{ gap: 2, cursor: 'pointer', listStyle: 'none' }}>
        <span className="label">Money talk</span>
        <span className="small muted">A few dates in with {otherName}. Couples who talk about money early argue about it less later.</span>
      </summary>
      <div className="row" style={{ gap: 6 }}>
        {STAGES.map((x, i) => <button key={x.title} type="button" className={i === stage ? 'btn sm' : 'btn ghost sm'} onClick={() => setStage(i)}>{i + 1}. {x.title}</button>)}
      </div>
      <span className="small muted">{s.when}. Tap one to put it in your message, then make it yours.</span>
      <div className="stack" style={{ gap: 6 }}>{s.qs.map((q) => <button key={q} type="button" className="q" onClick={() => use(q)} data-haptic="light">{q}</button>)}</div>
      {stage === 2 && <span className="small muted">Share what you’re comfortable with, when you’re comfortable. Never share account numbers or send money to someone you’re dating.</span>}
    </details>
  );
}
