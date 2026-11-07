'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { sendMessage } from '../../actions';

type Msg = { id: string; sender_id: string; body: string; created_at: string };

export default function Chat({ conversationId, meId, initial, canSend }: { conversationId: string; meId: string; initial: Msg[]; canSend: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb.channel(`conv-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Msg;
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [conversationId]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text;
    setText('');
    const r = await sendMessage(conversationId, body);
    if (!r.ok) { setErr(r.error || 'Could not send'); setText(body); }
  }
  return (
    <>
      <div className="stack" style={{ gap: 10 }}>
        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', padding: '11px 14px', fontSize: 15, lineHeight: 1.4, borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: mine ? 'var(--gold)' : '#1C1C1F', color: mine ? 'var(--onyx)' : 'var(--ivory)' }}>{m.body}</div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={send} style={{ position: 'fixed', left: 0, right: 0, bottom: 72, padding: '10px 16px', background: 'var(--onyx)', borderTop: '1px solid #1F1F22' }}>
        <div className="row" style={{ maxWidth: 440, margin: '0 auto' }}>
          <label className="grow"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Message</span>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={canSend ? 'Message' : 'Become a member to message'} disabled={!canSend} maxLength={2000} style={{ borderRadius: 999 }} />
          </label>
          <button className="btn sm" disabled={!canSend || !text.trim()} aria-label="Send">Send</button>
        </div>
        {err && <div className="notice error" style={{ maxWidth: 440, margin: '8px auto 0' }}>{err}</div>}
      </form>
    </>
  );
}
