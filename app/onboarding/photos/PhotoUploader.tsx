'use client';
import { useActionState, useState } from 'react';
import { uploadPhotos, type PhotoState } from '../actions';

export default function PhotoUploader({ doneHref = '/onboarding', max = 6 }: { doneHref?: string; max?: number }) {
  const [state, action, pending] = useActionState<PhotoState, FormData>(uploadPhotos, null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  if (state?.ok) {
    return (
      <div className="stack">
        {state.results?.map((r) => (
          <div key={r.name} className="card row">
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
    <form action={action} className="stack">
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
      {state && !state.ok && <div className="notice error">{state.message}</div>}
      <button className="btn block" disabled={pending}>{pending ? 'Checking your photos…' : 'Check and upload'}</button>
    </form>
  );
}
