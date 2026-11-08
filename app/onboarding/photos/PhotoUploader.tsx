'use client';
import { startTransition, useActionState, useState } from 'react';
import { uploadPhotos, type PhotoState } from '../actions';

/**
 * iPhone photos are 3-8 MB each (often HEIC) and Vercel rejects requests over 4.5 MB, so every image is
 * redrawn as a JPEG of at most `max` px before upload. Uses an <img> so Safari can decode HEIC.
 */
async function toJpeg(file: File, max: number, quality: number): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // couldn't decode here; send as-is and let the server decide
  } finally {
    URL.revokeObjectURL(url);
  }
}

const LIMIT = 4 * 1024 * 1024; // stay under Vercel's 4.5 MB request cap

export default function PhotoUploader({ doneHref = '/onboarding', max = 6 }: { doneHref?: string; max?: number }) {
  const [state, action, pending] = useActionState<PhotoState, FormData>(uploadPhotos, null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [prepping, setPrepping] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPrepError(null);
    const form = new FormData(e.currentTarget);
    const selfieFile = form.get('selfie');
    const photoFiles = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0).slice(0, max);
    if (!(selfieFile instanceof File) || !selfieFile.size) { setPrepError('Take a live selfie first.'); return; }
    if (!photoFiles.length) { setPrepError('Add at least one profile photo.'); return; }
    setPrepping(true);
    let size = 1600, quality = 0.82, out: File[] = [], selfieOut = selfieFile;
    for (let attempt = 0; attempt < 3; attempt++) {
      selfieOut = await toJpeg(selfieFile, Math.min(size, 1280), quality);
      out = await Promise.all(photoFiles.map((f) => toJpeg(f, size, quality)));
      const total = selfieOut.size + out.reduce((t, f) => t + f.size, 0);
      if (total <= LIMIT) break;
      size = Math.round(size * 0.75); quality = Math.max(0.6, quality - 0.1);
    }
    setPrepping(false);
    const total = selfieOut.size + out.reduce((t, f) => t + f.size, 0);
    if (total > LIMIT) { setPrepError('Those photos are too large together. Try fewer photos at a time.'); return; }
    const fd = new FormData();
    fd.append('selfie', selfieOut);
    out.forEach((f) => fd.append('photos', f));
    startTransition(() => action(fd));
  }
  if (state?.ok) {
    return (
      <div className="stack">
        {state.results?.map((r, i) => (
          <div key={i} className="card row">
            <span className="grow small">{r.name}</span>
            <span className="small" style={{ color: r.status === 'approved' ? 'var(--rise)' : r.status === 'error' ? 'var(--alert)' : 'var(--gold)' }}>
              {r.status === 'approved' ? `Matched${r.similarity ? ` · ${r.similarity}%` : ''}` : r.status === 'error' ? 'Upload failed' : 'In review'}
            </span>
          </div>
        ))}
        <p className="small muted" style={{ margin: 0 }}>Photos that need review stay hidden from other members until a person approves them.</p>
        <a className="btn block" href={doneHref}>{doneHref === '/onboarding' ? 'Continue' : 'Done'}</a>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="stack">
      <label className="card stack" style={{ cursor: 'pointer', borderColor: selfie ? 'var(--gold)' : undefined }}>
        <span style={{ fontWeight: 600 }}>1. Live selfie</span>
        {selfie ? <img src={selfie} alt="Your selfie preview" style={{ width: 120, height: 150, objectFit: 'cover', borderRadius: 12 }} /> : <span className="small muted">Opens your front camera on a phone.</span>}
        <input type="file" name="selfie" accept="image/*" capture="user" required style={{ fontSize: 14 }}
          onChange={(e) => { const f = e.target.files?.[0]; setSelfie(f ? URL.createObjectURL(f) : null); }} />
      </label>
      <label className="card stack" style={{ cursor: 'pointer' }}>
        <span style={{ fontWeight: 600 }}>2. Profile photos (up to {max})</span>
        {previews.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {previews.map((p) => <img key={p} src={p} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 10 }} />)}
          </div>
        )}
        <input type="file" name="photos" accept="image/*" multiple required style={{ fontSize: 14 }}
          onChange={(e) => setPreviews(Array.from(e.target.files || []).slice(0, max).map((f) => URL.createObjectURL(f)))} />
      </label>
      {(prepError || (state && !state.ok)) && <div className="notice error">{prepError || state?.message}</div>}
      <button className="btn block" disabled={pending || prepping}>{prepping ? 'Preparing your photos…' : pending ? 'Checking your photos…' : 'Check and upload'}</button>
    </form>
  );
}
