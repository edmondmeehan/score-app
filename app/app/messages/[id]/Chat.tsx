'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { haptic } from '@/lib/haptics';
import { kindClose, otherReadAt, sendMessage, sendPhoto, sendVoice } from '../../actions';
import VoiceRecorder, { type Recording } from '@/components/VoiceRecorder';
import { KIND_CLOSES, QUIET_HOURS, planItReady } from '@/lib/engagement';
import type { Pick } from './DatePanel';

type Msg = { id: string; sender_id: string; body: string; created_at: string; flag?: string | null; image_path?: string | null; audio_path?: string | null; audio_seconds?: number | null };

const WARN: Record<string, string> = {
  money: 'Be careful: never send money, gift cards or crypto to someone you haven’t met, and don’t share bank details. If this feels off, tap More → Report.',
  offplatform: 'Heads up: scammers often try to move chats off ScoreDate quickly. Take your time, and keep talking here until you’ve met.',
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

function Voice({ path, mine, seconds }: { path: string; mine: boolean; seconds?: number | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    supabaseBrowser().storage.from('chat').createSignedUrl(path, 3600).then(({ data }) => { if (live) setUrl(data?.signedUrl || null); });
    return () => { live = false; };
  }, [path]);
  return (
    <div className="voice-msg" style={{ background: mine ? 'var(--gold)' : 'var(--bubble)', color: mine ? 'var(--on-gold)' : 'var(--ivory)' }}>
      {url ? <audio controls preload="none" src={url} /> : <span className="small">Voice message</span>}
      {seconds ? <span className="small" style={{ opacity: 0.8 }}>{seconds}s</span> : null}
    </div>
  );
}

export default function Chat({ conversationId, meId, otherName, initial, canSend, initialReadAt, locked = 'Become a member to message', openers = [], open = true, startedAt, hasPlan = false, nudgePick = null }: { conversationId: string; meId: string; otherName: string; initial: Msg[]; canSend: boolean; initialReadAt: string | null; locked?: string; openers?: string[]; open?: boolean; startedAt?: string; hasPlan?: boolean; nudgePick?: Pick | null }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(initialReadAt);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const [recOpen, setRecOpen] = useState(false);
  // Other panels (Money talk) can drop a question into the composer.
  useEffect(() => {
    const onCompose = (e: Event) => { const t = (e as CustomEvent<{ text?: string }>).detail?.text; if (t) { setText(t); setTimeout(() => inputRef.current?.focus(), 0); } };
    window.addEventListener('sd:compose', onCompose);
    return () => window.removeEventListener('sd:compose', onCompose);
  }, []);
  const [nudgeOff, setNudgeOff] = useState<number | null>(null);
  useEffect(() => { try { const v = localStorage.getItem(`sd:planit:${conversationId}`); if (v) setNudgeOff(Number(v)); } catch { /* storage blocked */ } }, [conversationId]);
  const end = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb.channel(`conv-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Msg;
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        if (m.sender_id !== meId) haptic('medium');
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

  async function sendRecording(r: Recording) {
    const path = `${conversationId}/${meId}/${crypto.randomUUID()}.${r.ext}`;
    const { error } = await supabaseBrowser().storage.from('chat').upload(path, r.blob, { contentType: r.type || 'audio/mp4' });
    if (error) throw new Error(error.message);
    const res = await sendVoice(conversationId, path, r.seconds);
    if (!res.ok) throw new Error(res.error || 'Could not send');
    setRecOpen(false);
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

  async function close(choice: number) {
    setBusy(true); setErr(null);
    const r = await kindClose(conversationId, choice);
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'Could not close the chat'); return; }
    haptic('medium'); setClosed(true);
    setTimeout(() => { window.location.href = '/app/messages?ok=' + encodeURIComponent('Sent, and the chat is closed. Kind move.'); }, 900);
  }

  const lastMine = [...msgs].reverse().find((m) => m.sender_id === meId);
  const last = msgs[msgs.length - 1];
  const sentAny = Boolean(lastMine);
  const yourTurn = open && canSend && last && last.sender_id !== meId;
  const lastAt = new Date(last?.created_at || startedAt || Date.now()).getTime();
  // "Plan it": after ~10 messages with both people engaged, and no date suggested yet.
  const textMsgs = msgs.filter((m) => !m.image_path && !m.audio_path);
  const showPlanIt = open && canSend && !hasPlan && planItReady(textMsgs.map((m) => m.sender_id), meId)
    && (nudgeOff === null || msgs.length >= nudgeOff + 15);
  const loggedView = useRef(false);
  useEffect(() => {
    if (showPlanIt && nudgePick && !loggedView.current) { loggedView.current = true; supabaseBrowser().rpc('log_featured', { p_spot: nudgePick.id, p_kind: 'view' }).then(() => null, () => null); }
  }, [showPlanIt, nudgePick]);
  function planIt() {
    haptic('light');
    if (nudgePick) supabaseBrowser().rpc('log_featured', { p_spot: nudgePick.id, p_kind: 'click' }).then(() => null, () => null);
    window.dispatchEvent(new CustomEvent('sd:suggest-date', { detail: { pickId: nudgePick?.id } }));
  }
  function notYet() {
    setNudgeOff(msgs.length);
    try { localStorage.setItem(`sd:planit:${conversationId}`, String(msgs.length)); } catch { /* storage blocked */ }
  }
  const quiet = open && !closed && now !== null && now - lastAt > QUIET_HOURS * 3600000;
  const seen = lastMine && readAt && new Date(readAt).getTime() >= new Date(lastMine.created_at).getTime();

  return (
    <>
      <div className="stack" style={{ gap: 10 }}>
        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className="stack" style={{ gap: 6, alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {m.audio_path
                ? <Voice path={m.audio_path} mine={mine} seconds={m.audio_seconds} />
                : m.image_path
                ? <Photo path={m.image_path} mine={mine} />
                : <div style={{ maxWidth: '78%', padding: '11px 14px', fontSize: 15, lineHeight: 1.4, borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: mine ? 'var(--gold)' : 'var(--bubble)', color: mine ? 'var(--on-gold)' : 'var(--ivory)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>}
              {!mine && m.flag && WARN[m.flag] && <div className="msg-warning" role="note">{WARN[m.flag]}</div>}
              {mine && lastMine?.id === m.id && <span className="small muted" style={{ fontSize: 11 }}>{seen ? 'Read' : 'Delivered'}</span>}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {showPlanIt && !quiet && (
        <div className="card gold stack plan-it" style={{ gap: 8, marginTop: 12 }}>
          <span className="label">Plan it</span>
          <span className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>You two have a good thing going. Take it offline?</span>
          {nudgePick ? (
            <span className="small">Try <strong>{nudgePick.name}</strong>{nudgePick.neighborhood ? ` in ${nudgePick.neighborhood}` : ''}{nudgePick.perk ? <span className="pick-perk-line"> · ★ {nudgePick.perk}</span> : null}</span>
          ) : <span className="small muted">Most first dates are set within a day or two of a chat like this.</span>}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn sm" onClick={planIt}>{nudgePick ? `Suggest ${nudgePick.name}` : 'Suggest a date'}</button>
            <button type="button" className="btn ghost sm" onClick={notYet}>Not yet</button>
          </div>
          {nudgePick && <span className="small muted" style={{ fontSize: 11 }}>{nudgePick.badge} · ScoreDate Partners pay to be featured</span>}
        </div>
      )}
      {quiet && (
        <div className="card stack kind-close" style={{ gap: 8, marginTop: 12 }}>
          <span className="small"><strong>This chat’s been quiet for a couple of days.</strong> <span className="muted">Not feeling it? Send a kind goodbye and close it. {otherName} sees the message, nothing else.</span></span>
          {!closing ? (
            <button type="button" className="btn ghost sm" onClick={() => setClosing(true)} data-haptic="light">Close kindly</button>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {KIND_CLOSES.map((t, i) => <button key={i} type="button" className="choice-msg" disabled={busy} onClick={() => close(i + 1)}>{t}</button>)}
              <button type="button" className="btn ghost sm" onClick={() => setClosing(false)}>Keep chatting</button>
            </div>
          )}
        </div>
      )}
      <form onSubmit={send} className="composer">
        {yourTurn && !text && <div className="small" style={{ margin: '0 4px 6px', color: 'var(--gold-light)' }}>Your turn · {otherName} is waiting on you</div>}
        {canSend && open && !sentAny && openers.length > 0 && !text && (
          <div className="openers" aria-label="Opener ideas">
            {openers.map((o) => <button key={o} type="button" data-haptic="light" onClick={() => { setText(o); setTimeout(() => inputRef.current?.focus(), 0); }}>{o}</button>)}
          </div>
        )}
        {recOpen && canSend && <div style={{ margin: '0 4px 8px' }}><VoiceRecorder maxSeconds={60} onDone={sendRecording} onCancel={() => setRecOpen(false)} /></div>}
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn ghost sm" style={{ minHeight: 44, width: 44, padding: 0 }} disabled={!canSend || busy} onClick={() => setRecOpen((v) => !v)} aria-label="Record a voice message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          <button type="button" className="btn ghost sm" style={{ minHeight: 44, width: 44, padding: 0 }} disabled={!canSend || busy} onClick={() => fileRef.current?.click()} aria-label="Send a photo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="12" cy="12" r="3.2" /></svg>
          </button>
          <label className="grow"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Message</span>
            <input ref={inputRef} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={canSend ? `Message ${otherName}` : locked} disabled={!canSend} maxLength={2000} />
          </label>
          <button className="btn sm" style={{ minHeight: 44 }} disabled={!canSend || !text.trim()} aria-label="Send">Send</button>
        </div>
        {busy && <div className="small muted" style={{ margin: '6px 4px 2px' }}>Sending photo…</div>}
        {err && <div className="notice error" style={{ margin: '6px 4px 2px' }}>{err}</div>}
      </form>
    </>
  );
}
