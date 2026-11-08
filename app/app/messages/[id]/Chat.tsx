'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { haptic } from '@/lib/haptics';
import { otherReadAt, sendMessage, sendPhoto } from '../../actions';

type Msg = { id: string; sender_id: string; body: string; created_at: string; flag?: string | null; image_path?: string | null };

const WARN: Record<string, string> = {
  money: 'Be careful: never send money, gift cards or crypto to someone you haven’t met, and don’t share bank details. If this feels off, tap More → Report.',
  offplatform: 'Heads up: scammers often try to move chats off Score quickly. Take your time, and keep talking here until you’ve met.',
  harassment: 'This message may break our community guidelines. You can report or unmatch from More at the top.',
};

/** Resize to max 1600px JPEG before upload (keeps chat photos small and strips most metadata). */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
}

function Photo({ path, mine }: { path: string; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [shown, setShown] = useState(mine);
  useEffect(() => {
    let live = true;
    supabaseBrowser().storage.from('chat').createSignedUrl(path, 3600).then(({ data }) => { if (live) setUrl(data?.signedUrl || null); });
    return () => { live = false; };
  }, [path]);
  return (
    <button type="button" className={`chat-photo${shown ? '' : ' hidden'}`} onClick={() => { setShown(true); haptic('light'); }} aria-label={shown ? 'Photo' : 'Tap to view photo'}>
      {url && <img src={url} alt="" draggable={false} />}
      {!shown && <span className="chat-photo-label">Photo · Tap to view</span>}
    </button>
  );
}

export default function Chat({ conversationId, meId, otherName, initial, canSend, initialReadAt, locked = 'Become a member to message' }: { conversationId: string; meId: string; otherName: string; initial: Msg[]; canSend: boolean; initialReadAt: string | null; locked?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(initialReadAt);
  const end = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb.channel(`conv-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Msg;
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        if (m.sender_id !== meId) haptic('light');
      })
      .subscribe();
    const t = setInterval(() => { otherReadAt(conversationId).then(setReadAt).catch(() => null); }, 15000);
    return () => { sb.removeChannel(ch); clearInterval(t); };
  }, [conversationId, meId]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text;
    setText('');
    const r = await sendMessage(conversationId, body);
    if (!r.ok) { setErr(r.error || 'Could not send'); setText(body); }
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { setErr('Choose a photo.'); return; }
    if (f.size > 15 * 1024 * 1024) { setErr('That photo is too large.'); return; }
    setBusy(true); setErr(null);
    try {
      const blob = await shrink(f);
      const path = `${conversationId}/${meId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabaseBrowser().storage.from('chat').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error(error.message);
      const r = await sendPhoto(conversationId, path);
      if (!r.ok) throw new Error(r.error || 'Could not send');
      haptic('light');
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not send photo'); }
    setBusy(false);
  }

  const lastMine = [...msgs].reverse().find((m) => m.sender_id === meId);
  const seen = lastMine && readAt && new Date(readAt).getTime() >= new Date(lastMine.created_at).getTime();

  return (
    <>
      <div className="stack" style={{ gap: 10 }}>
        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className="stack" style={{ gap: 6, alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {m.image_path
                ? <Photo path={m.image_path} mine={mine} />
                : <div style={{ maxWidth: '78%', padding: '11px 14px', fontSize: 15, lineHeight: 1.4, borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: mine ? 'var(--gold)' : 'var(--bubble)', color: mine ? 'var(--on-gold)' : 'var(--ivory)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>}
              {!mine && m.flag && WARN[m.flag] && <div className="msg-warning" role="note">{WARN[m.flag]}</div>}
              {mine && lastMine?.id === m.id && <span className="small muted" style={{ fontSize: 11 }}>{seen ? 'Read' : 'Delivered'}</span>}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="composer">
        <div className="row" style={{ gap: 6 }}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          <button type="button" className="btn ghost sm" style={{ minHeight: 44, width: 44, padding: 0 }} disabled={!canSend || busy} onClick={() => fileRef.current?.click()} aria-label="Send a photo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="12" cy="12" r="3.2" /></svg>
          </button>
          <label className="grow"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Message</span>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={canSend ? `Message ${otherName}` : locked} disabled={!canSend} maxLength={2000} />
          </label>
          <button className="btn sm" style={{ minHeight: 44 }} disabled={!canSend || !text.trim()} aria-label="Send">Send</button>
        </div>
        {busy && <div className="small muted" style={{ margin: '6px 4px 2px' }}>Sending photo…</div>}
        {err && <div className="notice error" style={{ margin: '6px 4px 2px' }}>{err}</div>}
      </form>
    </>
  );
}
