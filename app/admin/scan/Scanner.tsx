'use client';
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { haptic } from '@/lib/haptics';

type Member = { id: string; first_name: string | null; age: number | null; status: string; plan: string; id_status: string; photo_status: string; band: string | null; is_founder: boolean; photo: string | null };
type Result = { ok: boolean; error?: string; member?: Member; scan?: { result: string; going?: number; checked_in?: number } };
const LABEL: Record<string, [string, string]> = {
  checked_in: ['Checked in', 'ok'], already_in: ['Already checked in', 'warn'], no_rsvp: ['Not on the list', 'bad'],
  rsvp_waitlist: ['On the waitlist', 'warn'], rsvp_cancelled: ['Cancelled their RSVP', 'bad'], ok: ['Valid member', 'ok'],
};

export default function Scanner({ events, initialEvent }: { events: { id: string; title: string; starts_at: string }[]; initialEvent?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [eventId, setEventId] = useState(events.some((e) => e.id === initialEvent) ? initialEvent! : events[0]?.id || '');
  const [res, setRes] = useState<Result | null>(null);
  const [cam, setCam] = useState<'off' | 'on' | 'denied'>('off');
  const [manual, setManual] = useState('');
  const busy = useRef(false);
  const last = useRef<{ t: string; at: number }>({ t: '', at: 0 });
  const eventRef = useRef(eventId);
  eventRef.current = eventId;

  async function check(token: string) {
    if (busy.current) return;
    if (token === last.current.t && Date.now() - last.current.at < 4000) return;
    busy.current = true; last.current = { t: token, at: Date.now() };
    try {
      const r = await fetch('/api/staff/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, eventId: eventRef.current || null }) });
      const j: Result = await r.json();
      setRes(j);
      const kind = j.ok ? LABEL[j.scan?.result || 'ok']?.[1] : 'bad';
      haptic(kind === 'ok' ? 'success' : 'warning');
    } catch { setRes({ ok: false, error: 'Network error. Try again.' }); }
    finally { setTimeout(() => { busy.current = false; }, 1200); }
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!video.current) return;
      video.current.srcObject = stream;
      await video.current.play();
      setCam('on');
    } catch { setCam('denied'); }
  }

  useEffect(() => {
    if (cam !== 'on') return;
    let raf = 0;
    const loop = () => {
      const v = video.current, c = canvas.current;
      if (v && c && v.readyState >= 2) {
        const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(v, 0, 0, w, h);
        const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        if (code?.data && /\/p\/SD1\.|^SD1\./.test(code.data)) check(code.data);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const v = video.current;
    return () => { cancelAnimationFrame(raf); (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam]);

  const [label, tone] = res?.ok ? LABEL[res.scan?.result || 'ok'] || ['Valid member', 'ok'] : ['Not valid', 'bad'];
  const m = res?.member;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <label className="field">Checking in to
        <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">No event (just verify the member)</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title} · {new Date(e.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}</option>)}
        </select>
      </label>
      <div className="scan-box">
        <video ref={video} playsInline muted style={{ display: cam === 'on' ? 'block' : 'none' }} />
        {cam !== 'on' && (
          <div className="stack" style={{ gap: 10, alignItems: 'center', padding: 30, textAlign: 'center' }}>
            {cam === 'denied' ? <span className="small" style={{ color: 'var(--alert)' }}>Camera access was blocked. Allow the camera for this site in your browser settings, or type the code below.</span> : <span className="small muted">Point the camera at a member’s pass.</span>}
            <button type="button" className="btn" onClick={start}>Start scanner</button>
          </div>
        )}
        {cam === 'on' && <span className="scan-frame" aria-hidden />}
        <canvas ref={canvas} style={{ display: 'none' }} />
      </div>

      {res && (
        <div className={`scan-result ${tone}`}>
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            {m && <div className="pass-photo">{m.photo ? <img src={m.photo} alt="" /> : <span className="serif">{m.first_name?.[0]}</span>}</div>}
            <div className="stack" style={{ gap: 4, minWidth: 0 }}>
              <strong className="serif" style={{ fontSize: 28, lineHeight: 1 }}>{label}</strong>
              {m ? <span>{m.first_name}{m.age ? `, ${m.age}` : ''} · {m.plan}{m.is_founder ? ' · Founding Member' : ''}</span> : <span className="small">{res.error}</span>}
              {m && <span className="small muted">ID {m.id_status === 'approved' ? 'verified' : m.id_status} · Account {m.status}</span>}
              {res.scan?.going != null && eventId && <span className="small muted">{res.scan.checked_in} of {res.scan.going} checked in</span>}
            </div>
          </div>
        </div>
      )}

      <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (manual.trim()) check(manual.trim()); }}>
        <input className="input grow" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or paste a pass code" autoCapitalize="none" />
        <button className="btn ghost sm">Check</button>
      </form>
    </div>
  );
}
