'use client';
import { useEffect, useState } from 'react';
import { aiOpeners, turnOnAiIdeas, type AiResult } from './aiOpeners';

/**
 * Opener ideas above the composer. With AI ideas on (opt-in), it asks for 3 fresh, profile-specific openers every time
 * the chat opens, plus "New ideas". Otherwise it shows the built-in suggestions.
 */
export default function OpenerIdeas({ conversationId, otherName, fallback, aiOn: aiOnInitial, onPick }: { conversationId: string; otherName: string; fallback: string[]; aiOn: boolean; onPick: (t: string) => void }) {
  const [aiOn, setAiOn] = useState(aiOnInitial);
  const [ideas, setIdeas] = useState<string[]>(fallback);
  const [status, setStatus] = useState<AiResult['status'] | 'loading' | null>(null);
  const [asking, setAsking] = useState(false);

  const load = async () => {
    setStatus('loading');
    const r = await aiOpeners(conversationId).catch(() => ({ status: 'unavailable' as const }));
    if (r.status === 'ok' && 'ideas' in r && r.ideas) setIdeas(r.ideas);
    setStatus(r.status);
  };
  useEffect(() => { if (aiOn) load(); }, [aiOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const note = status === 'other_off' ? `Fresh AI ideas need ${otherName} to turn them on too, so these are our usual picks.`
    : status === 'limit' ? 'You’ve used today’s AI ideas. More tomorrow.'
    : status === 'unavailable' ? null : null;

  return (
    <div style={{ marginBottom: 6 }}>
      <div className="openers" aria-label="Opener ideas" aria-busy={status === 'loading'}>
        {status === 'loading' ? [0, 1, 2].map((i) => <span key={i} className="bone" style={{ flex: 'none', width: 220, height: 54, borderRadius: 14 }} />)
          : ideas.map((o) => <button key={o} type="button" data-haptic="light" onClick={() => onPick(o)}>{o}</button>)}
      </div>
      <div className="row small" style={{ gap: 10, margin: '0 4px', flexWrap: 'wrap' }}>
        {aiOn ? (
          <button type="button" className="footer-link" style={{ color: 'var(--gold-light)', fontSize: 12, background: 'none', border: 0, padding: 0, cursor: 'pointer' }} disabled={status === 'loading'} onClick={load}>↻ New ideas</button>
        ) : !asking ? (
          <button type="button" style={{ color: 'var(--gold-light)', fontSize: 12, background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => setAsking(true)}>Get fresh ideas written for this chat</button>
        ) : null}
        {note && <span className="muted" style={{ fontSize: 12 }}>{note}</span>}
      </div>
      {asking && !aiOn && (
        <div className="card stack" style={{ gap: 8, padding: 12, marginTop: 8 }}>
          <strong className="small">Turn on AI conversation ideas?</strong>
          <span className="small muted">To write openers for a chat, ScoreDate sends parts of both profiles (first names, prompts, NYC spots, song, job and neighborhood) to our AI provider, Anthropic. It never sees your credit band, messages, photos or contact details, and it isn’t used to train AI models. Ideas only appear when both people have this on. You can turn it off any time in Settings.</span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn sm" onClick={async () => { await turnOnAiIdeas(true); setAsking(false); setAiOn(true); }}>Turn on</button>
            <button type="button" className="btn ghost sm" onClick={() => setAsking(false)}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}
