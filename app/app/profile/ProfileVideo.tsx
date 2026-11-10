'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { setProfileVideo } from './actions';

const MAX_SECONDS = 15;
const MAX_BYTES = 50 * 1024 * 1024;

/** Read a video's length in the browser before uploading. */
function duration(file: File) {
  return new Promise<number>((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

export default function ProfileVideo({ userId, url, status, seconds }: { userId: string; url: string | null; status: 'none' | 'pending' | 'approved' | 'rejected'; seconds: number | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(null);
    if (file.size > MAX_BYTES) { setErr('That clip is too big. Pick one under 50 MB (about 15 seconds).'); return; }
    const len = await duration(file);
    if (len > MAX_SECONDS + 0.5) { setErr(`Keep it to ${MAX_SECONDS} seconds. Trim it in Photos first (Edit, then drag the ends).`); return; }
    setBusy('Uploading…');
    try {
      const ext = file.type === 'video/quicktime' ? 'mov' : file.type === 'video/webm' ? 'webm' : 'mp4';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabaseBrowser().storage.from('videos').upload(path, file, { contentType: file.type || 'video/mp4' });
      if (error) throw new Error(error.message);
      const r = await setProfileVideo(path, Math.max(1, Math.round(len || MAX_SECONDS)));
      if (!r.ok) throw new Error(r.error || 'Couldn’t save it');
      router.refresh();
    } catch (x) { setErr((x as Error).message || 'Upload failed. Try again.'); }
    finally { setBusy(null); }
  }

  async function remove() { setBusy('Removing…'); await setProfileVideo('', 0); setBusy(null); router.refresh(); }

  const label = status === 'pending' ? 'In review: only you can see it for now. Usually reviewed within a day.'
    : status === 'approved' ? 'Live on your profile.'
    : status === 'rejected' ? 'Not approved. Try a clip of just you, face visible, nothing explicit.' : null;

  return (
    <section id="video" className="card stack">
      <span className="label">Video clip</span>
      <span className="small muted">Add up to {MAX_SECONDS} seconds of you: a laugh, your neighborhood, the view from your run. Every clip is reviewed before members can see it.</span>
      {url && (
        <div className="stack" style={{ gap: 8 }}>
          <video src={url} controls playsInline muted preload="metadata" style={{ width: '100%', maxHeight: 420, borderRadius: 14, background: '#000' }} />
          {label && <span className="small" style={{ color: status === 'approved' ? 'var(--rise)' : status === 'rejected' ? 'var(--alert)' : 'var(--gold-light)' }}>{label}</span>}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn ghost sm" disabled={Boolean(busy)} onClick={() => input.current?.click()}>Replace</button>
            <button type="button" className="btn ghost sm" disabled={Boolean(busy)} onClick={remove}>Remove</button>
            {seconds ? <span className="small muted">{seconds}s</span> : null}
          </div>
        </div>
      )}
      {!url && <button type="button" className="btn ghost" disabled={Boolean(busy)} onClick={() => input.current?.click()}>{busy || 'Add a video clip'}</button>}
      {busy && url && <span className="small muted">{busy}</span>}
      {err && <div className="notice error small">{err}</div>}
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" hidden onChange={pick} />
    </section>
  );
}
