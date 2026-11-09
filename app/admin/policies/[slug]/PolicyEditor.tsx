'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePolicy, savePartners, resetPolicy, restoreVersion, type SaveResult } from '../actions';

function Result({ res }: { res: SaveResult | null }) {
  if (res?.ok) return <div className="notice">{res.ok}</div>;
  if (!res?.errors?.length) return null;
  return (
    <div className="notice error stack" style={{ gap: 4 }}>
      <strong>Not saved yet. Fix these first:</strong>
      {res.errors.map((e) => <span key={e} className="small">• {e}</span>)}
    </div>
  );
}

function useSave(fn: (fd: FormData) => Promise<SaveResult>) {
  const router = useRouter();
  const [res, setRes] = useState<SaveResult | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => { const r = await fn(fd); setRes(r); if (r.ok) router.refresh(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  };
  const run = (p: Promise<SaveResult>) => start(async () => { const r = await p; setRes(r); if (r.ok) window.location.reload(); });
  return { res, pending, onSubmit, run };
}

const HELP = 'Format: “## Heading” starts a section (keep any {#id} so existing links still work), “### ” is a subheading, “- ” is a bullet, a blank line starts a new paragraph. **bold** and [link text](/page) work too.';

export default function PolicyEditor({ owner, custom, slug, initial }: { owner: boolean; custom: boolean; slug: string; initial: { title: string; summary: string; updated: string; draft: boolean; body: string } }) {
  const { res, pending, onSubmit, run } = useSave(savePolicy);
  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: 16 }}>
      <Result res={res} />
      <span className="small muted">{custom ? 'Showing your saved version.' : 'Showing the built-in text. Your first save creates an editable copy.'}</span>
      <fieldset disabled={!owner || pending} className="stack" style={{ gap: 16, border: 0, padding: 0, margin: 0 }}>
        <input type="hidden" name="slug" value={slug} />
        <section className="card stack" style={{ gap: 12 }}>
          <label className="field">Title<input className="input" name="title" defaultValue={initial.title} maxLength={120} required /></label>
          <label className="field">Summary (shown under the title)<textarea className="input" name="summary" rows={2} defaultValue={initial.summary} maxLength={600} /></label>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field grow">Last updated<input className="input" name="updated" defaultValue={initial.updated} maxLength={60} /></label>
            <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="bump" defaultChecked style={{ width: 18, height: 18, accentColor: 'var(--gold)' }} />Set to today when I save</label>
            <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="draft" defaultChecked={initial.draft} style={{ width: 18, height: 18, accentColor: 'var(--gold)' }} />Show “Draft for review” banner</label>
          </div>
        </section>
        <section className="card stack" style={{ gap: 8 }}>
          <strong>Policy text</strong>
          <span className="small muted">{HELP}</span>
          <textarea className="input mono" name="body" defaultValue={initial.body} rows={32} spellCheck style={{ fontSize: 13, lineHeight: 1.55, minHeight: 480 }} />
        </section>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn">{pending ? 'Saving…' : 'Save and publish'}</button>
          {custom && <button type="button" className="btn ghost" onClick={() => { if (confirm('Go back to the built-in text? Your saved version stays in the history below.')) run(resetPolicy(slug)); }}>Reset to built-in text</button>}
        </div>
      </fieldset>
    </form>
  );
}

export function PartnersEditor({ owner, custom, initial }: { owner: boolean; custom: boolean; initial: { eyebrow: string; title: string; intro: string; facts: string; ways: string } }) {
  const { res, pending, onSubmit, run } = useSave(savePartners);
  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: 16 }}>
      <Result res={res} />
      <span className="small muted">{custom ? 'Showing your saved version.' : 'Showing the built-in text.'} The inquiry form at the bottom of the page stays the same.</span>
      <fieldset disabled={!owner || pending} className="stack" style={{ gap: 16, border: 0, padding: 0, margin: 0 }}>
        <section className="card stack" style={{ gap: 12 }}>
          <label className="field">Small label above the headline<input className="input" name="eyebrow" defaultValue={initial.eyebrow} maxLength={40} /></label>
          <label className="field">Headline<input className="input" name="title" defaultValue={initial.title} maxLength={160} required /></label>
          <label className="field">Intro<textarea className="input" name="intro" rows={3} defaultValue={initial.intro} maxLength={800} /></label>
        </section>
        <section className="card stack" style={{ gap: 12 }}>
          <label className="field">Highlights (up to 6, one per line: Big text | small text)<textarea className="input mono" name="facts" rows={4} defaultValue={initial.facts} style={{ fontSize: 13 }} /></label>
          <label className="field">Ways to partner (up to 8, one per line: Title | description)<textarea className="input mono" name="ways" rows={8} defaultValue={initial.ways} style={{ fontSize: 13 }} /></label>
        </section>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn">{pending ? 'Saving…' : 'Save and publish'}</button>
          {custom && <button type="button" className="btn ghost" onClick={() => { if (confirm('Go back to the built-in Partners page?')) run(resetPolicy('partners')); }}>Reset to built-in text</button>}
        </div>
      </fieldset>
    </form>
  );
}

export function VersionList({ versions, owner }: { versions: { id: number; at: string; by: string | null; reset: boolean; current: boolean }[]; owner: boolean }) {
  const { res, pending, run } = useSave(async () => ({}));
  if (!versions.length) return null;
  return (
    <section className="card stack" style={{ gap: 8 }}>
      <strong>History</strong>
      <Result res={res} />
      {versions.map((v) => (
        <div key={v.id} className="row small" style={{ gap: 10, justifyContent: 'space-between' }}>
          <span className="muted">{new Date(v.at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}{v.by ? ` · ${v.by}` : ''}{v.reset ? ' · reset to built-in' : ''}{v.current ? ' · current' : ''}</span>
          {owner && !v.current && <button type="button" className="btn ghost sm" disabled={pending} onClick={() => { if (confirm('Restore this version? It goes live right away.')) run(restoreVersion(v.id)); }}>Restore</button>}
        </div>
      ))}
    </section>
  );
}
