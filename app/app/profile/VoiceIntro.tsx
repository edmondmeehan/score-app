'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import VoiceRecorder, { type Recording } from '@/components/VoiceRecorder';
import { setVoiceIntro } from './actions';

export default function VoiceIntro({ userId, url, seconds }: { userId: string; url: string | null; seconds: number | null }) {
  const [recording, setRecording] = useState(false);
  const router = useRouter();
  async function save(r: Recording) {
    const path = `${userId}/${crypto.randomUUID()}.${r.ext}`;
    const { error } = await supabaseBrowser().storage.from('voices').upload(path, r.blob, { contentType: r.type || 'audio/mp4' });
    if (error) throw new Error(error.message);
    const res = await setVoiceIntro(path, r.seconds);
    if (!res.ok) throw new Error(res.error || 'Could not save');
    setRecording(false); router.refresh();
  }
  async function remove() { await setVoiceIntro('', 0); router.refresh(); }
  return (
    <section id="voice" className="card stack">
      <span className="label">Voice intro</span>
      <span className="small muted">Say hi in up to 30 seconds. People feel chemistry in a voice that a profile can’t show. Ideas: what a great Saturday looks like, or the story behind your song.</span>
      {url && !recording && (
        <div className="stack" style={{ gap: 8 }}>
          <audio controls src={url} style={{ width: '100%' }} />
          <div className="row" style={{ gap: 8 }}><button type="button" className="btn ghost sm" onClick={() => setRecording(true)}>Record a new one</button><button type="button" className="btn ghost sm" onClick={remove}>Remove</button>{seconds ? <span className="small muted">{seconds}s</span> : null}</div>
        </div>
      )}
      {(!url || recording) && <VoiceRecorder maxSeconds={30} sendLabel="Save to profile" onDone={save} onCancel={url ? () => setRecording(false) : undefined} />}
    </section>
  );
}
