'use client';
import { useState } from 'react';
import { uploadPhotos, type PhotoState } from '../actions';

/** Photos smaller than this on their shortest side look soft or pixelated on a phone, so we ask for a better one. */
const MIN_SIDE = 720;

type Loaded = { img: HTMLImageElement; w: number; h: number } | null;
async function load(file: File): Promise<Loaded> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    return { img, w: img.naturalWidth, h: img.naturalHeight };
  } catch { return null; } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
}

/**
 * iPhone photos are 3-8 MB each (often HEIC) and Vercel rejects requests over 4.5 MB, so each image is redrawn as a
 * high-quality JPEG (up to 2048 px) and sent in its own request. Uses an <img> so Safari can decode HEIC.
 */
async function toJpeg(file: File, max: number, quality: number): Promise<File> {
  const l = await load(file);
  if (!l) return file; // couldn't decode here; send as-is and let the server decide
  const scale = Math.min(1, max / Math.max(l.w, l.h));
  const c = document.createElement('canvas');
  c.width = Math.round(l.w * scale); c.height = Math.round(l.h * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(l.img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

const LIMIT = 4 * 1024 * 1024; // stay under Vercel's 4.5 MB request cap

/** Best quality that fits in one request: start at 2048 px / 0.9 and step down only if a photo is unusually heavy. */
async function prepare(file: File, max: number): Promise<File> {
  let size = max, quality = 0.9, out = await toJpeg(file, size, quality);
  while (out.size > LIMIT - 600_000 && size > 1200) { size = Math.round(size * 0.85); quality = Math.max(0.78, quality - 0.04); out = await toJpeg(file, size, quality); }
  return out;
}

export default function PhotoUploader({ doneHref = '/onboarding', max = 6 }: { doneHref?: string; max?: number }) {
  const [state, setState] = useState<PhotoState>(null);
  const [pending, setPending] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [prepping, setPrepping] = useState<string | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPrepError(null); setState(null);
    const form = new FormData(e.currentTarget);
    const selfieFile = form.get('selfie');
    const photoFiles = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0).slice(0, max);
    if (!(selfieFile instanceof File) || !selfieFile.size) { setPrepError('Take a live selfie first.'); return; }
    if (!photoFiles.length) { setPrepError('Add at least one profile photo.'); return; }
    // Quality check before anything uploads.
    setPrepping('Checking photo quality…');
    const small: string[] = [];
    for (const f of photoFiles) {
      const l = await load(f);
      if (l && Math.min(l.w, l.h) < MIN_SIDE) small.push(f.name);
    }
    if (small.length) {
      setPrepping(null);
      setPrepError(`${small.length === 1 ? 'One photo is' : `${small.length} photos are`} too low-resolution and would look blurry: ${small.join(', ')}. Use the original from your camera roll, not a screenshot or a photo saved from social media.`);
      return;
    }
    setPrepping('Preparing your photos…');
    const selfieOut = await prepare(selfieFile, 1280);
    const ready: File[] = [];
    for (const f of photoFiles) ready.push(await prepare(f, 2048));
    setPrepping(null);
    setPending(true);
    const results: NonNullable<PhotoState>['results'] = [];
    for (const f of ready) {
      const fd = new FormData();
      fd.append('selfie', selfieOut);
      fd.append('photos', f);
      const r = await uploadPhotos(null, fd).catch(() => ({ ok: false, message: 'Upload failed. Check your connection and try again.' }) as PhotoState);
      if (r?.ok) results.push(...(r.results || []));
      else { setPending(false); setState(results.length ? { ok: true, message: 'Some photos uploaded.', results } : r); if (!results.length) return; break; }
    }
    setPending(false);
    setState((s) => (s && !s.ok ? s : { ok: true, message: 'Photos checked.', results }));
  }
  if (state?.ok) {
    return (
      <div className="stack">
        {state.results?.map((r, i) => (
          <div key={i} className="card row">
            <span className="grow small">{r.name}</span>
            <span className="small" style={{ color: r.status === 'approved' ? 'var(--rise)' : r.status === 'error' ? 'var(--alert)' : 'var(--gold)' }}>
              {r.status === 'approved' ? `Matched${r.similarity ? ` · ${r.similarity}%` : ''}` : r.status === 'error' ? (r.reason?.startsWith('Too low') ? 'Too low-res' : 'Upload failed') : 'In review'}
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
      <button className="btn block" disabled={pending || Boolean(prepping)}>{prepping || (pending ? 'Checking your photos…' : 'Check and upload')}</button>
    </form>
  );
}
