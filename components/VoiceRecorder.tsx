'use client';
import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';

export type Recording = { blob: Blob; seconds: number; ext: string; type: string };

function pickType(): { type: string; ext: string } {
  const opts = [{ type: 'audio/mp4', ext: 'm4a' }, { type: 'audio/webm;codecs=opus', ext: 'webm' }, { type: 'audio/webm', ext: 'webm' }];
  for (const o of opts) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(o.type)) return o;
  return { type: '', ext: 'webm' };
}

/** Tap to record, tap to stop (auto-stops at maxSeconds), listen back, then send or redo. */
export default function VoiceRecorder({ maxSeconds, onDone, onCancel, sendLabel = 'Send' }: {
  maxSeconds: number; onDone: (r: Recording) => Promise<void> | void; onCancel?: () => void; sendLabel?: string;
}) {
  const [state, setState] = useState<'idle' | 'rec' | 'review' | 'busy'>('idle');
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [rec, setRec] = useState<Recording | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); mr.current?.stream.getTracks().forEach((t) => t.stop()); if (url) URL.revokeObjectURL(url); }, [url]);

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { type, ext } = pickType();
      const m = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      m.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      m.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const seconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        const blob = new Blob(chunks.current, { type: m.mimeType || type || 'audio/webm' });
        const r = { blob, seconds: Math.min(seconds, maxSeconds), ext: (m.mimeType || '').includes('mp4') ? 'm4a' : ext, type: blob.type };
        setRec(r); setUrl(URL.createObjectURL(blob)); setState('review');
      };
      mr.current = m; started.current = Date.now(); setSecs(0);
      m.start(); setState('rec'); haptic('light');
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - started.current) / 1000);
        setSecs(s);
        if (s >= maxSeconds) stop();
      }, 250);
    } catch {
      setErr('Allow microphone access to record. On iPhone: Settings → ScoreDate → Microphone.');
    }
  }
  function stop() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (mr.current?.state === 'recording') mr.current.stop();
  }
  async function send() {
    if (!rec) return;
    setState('busy');
    try { await onDone(rec); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send'); setState('review'); return; }
    setRec(null); setUrl(null); setState('idle');
  }
  const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

  return (
    <div className="voice-rec stack" style={{ gap: 8 }}>
      {state === 'idle' && <div className="row" style={{ gap: 8 }}><button type="button" className="btn sm" onClick={start}>● Record</button>{onCancel && <button type="button" className="btn ghost sm" onClick={onCancel}>Cancel</button>}<span className="small muted">Up to {maxSeconds} seconds</span></div>}
      {state === 'rec' && <div className="row" style={{ gap: 10 }}><span className="rec-dot" aria-hidden /><span className="mono">{mmss(secs)} / {mmss(maxSeconds)}</span><button type="button" className="btn sm" onClick={stop}>Stop</button></div>}
      {(state === 'review' || state === 'busy') && url && (
        <div className="stack" style={{ gap: 8 }}>
          <audio controls src={url} style={{ width: '100%' }} />
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn sm" disabled={state === 'busy'} onClick={send} data-haptic="success">{state === 'busy' ? 'Sending…' : sendLabel}</button>
            <button type="button" className="btn ghost sm" disabled={state === 'busy'} onClick={() => { setRec(null); setUrl(null); setState('idle'); }}>Redo</button>
            {onCancel && <button type="button" className="btn ghost sm" disabled={state === 'busy'} onClick={() => { setRec(null); setUrl(null); setState('idle'); onCancel(); }}>Cancel</button>}
          </div>
        </div>
      )}
      {err && <div className="notice error">{err}</div>}
    </div>
  );
}
