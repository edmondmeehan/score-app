'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveFooter, resetFooter, type SaveResult } from './actions';

type Initial = {
  tagline: string; company: string; address: string; email: string; copyright: string; disclaimer: string; app_links: string;
  cols: { title: string; links: string }[];
};

export default function FooterEditor({ owner, custom, initial }: { owner: boolean; custom: boolean; initial: Initial; defaults: { disclaimer: string } }) {
  const router = useRouter();
  const [res, setRes] = useState<SaveResult | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveFooter(fd);
      setRes(r);
      if (r.ok) router.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };
  const onReset = () => {
    if (!confirm('Reset the footer to the built-in default? Your saved changes will be replaced.')) return;
    start(async () => {
      const r = await resetFooter();
      setRes(r);
      if (r.ok) window.location.reload();
    });
  };

  const linkHelp = 'One link per line: Label | /page  (or https://… or mailto:…)';

  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: 20 }}>
      {res?.ok && <div className="notice">{res.ok}</div>}
      {res?.errors?.length ? (
        <div className="notice error stack" style={{ gap: 4 }}>
          <strong>Not saved yet. Fix these first:</strong>
          {res.errors.map((e) => <span key={e} className="small">• {e}</span>)}
        </div>
      ) : null}

      <fieldset disabled={!owner || pending} className="stack" style={{ gap: 20, border: 0, padding: 0, margin: 0 }}>
        <section className="card stack" style={{ gap: 12 }}>
          <strong>Brand and contact</strong>
          <label className="field">Tagline<textarea className="input" name="tagline" rows={2} defaultValue={initial.tagline} maxLength={300} /></label>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <label className="field grow">Company name<input className="input" name="company" defaultValue={initial.company} maxLength={120} required /></label>
            <label className="field grow">Support email<input className="input" name="email" type="email" defaultValue={initial.email} maxLength={120} /></label>
          </div>
          <label className="field">Address (one line per row)<textarea className="input" name="address" rows={3} defaultValue={initial.address} maxLength={300} /></label>
        </section>

        <section className="card stack" style={{ gap: 12 }}>
          <strong>Link columns (website)</strong>
          <span className="small muted">{linkHelp}. Leave a column blank to hide it. Terms, Privacy and Your privacy choices must stay in one of the columns.</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {initial.cols.map((c, i) => (
              <div key={i} className="stack" style={{ gap: 8 }}>
                <label className="field">Column {i + 1} heading<input className="input" name={`col${i}_title`} defaultValue={c.title} maxLength={40} placeholder="Leave blank to hide" /></label>
                <textarea className="input mono" name={`col${i}_links`} rows={6} defaultValue={c.links} style={{ fontSize: 13 }} placeholder={'Contact | /contact'} aria-label={`Column ${i + 1} links`} />
              </div>
            ))}
          </div>
        </section>

        <section className="card stack" style={{ gap: 12 }}>
          <strong>Bottom of the footer</strong>
          <label className="field">Copyright line<input className="input" name="copyright" defaultValue={initial.copyright} maxLength={300} /></label>
          <span className="small muted" style={{ marginTop: -6 }}>Type {'{year}'} to show the current year automatically.</span>
          <label className="field">Credit disclaimer<textarea className="input" name="disclaimer" rows={3} defaultValue={initial.disclaimer} maxLength={1200} required /></label>
          <span className="small muted" style={{ marginTop: -6 }}>Required. Have counsel review any change to this wording.</span>
        </section>

        <section className="card stack" style={{ gap: 12 }}>
          <strong>In-app footer</strong>
          <span className="small muted">Shown at the bottom of Settings and Discover in the app. {linkHelp}. Terms and Privacy must stay.</span>
          <textarea className="input mono" name="app_links" rows={5} defaultValue={initial.app_links} style={{ fontSize: 13 }} aria-label="In-app footer links" />
        </section>
      </fieldset>

      {owner && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Save footer'}</button>
          {custom && <button type="button" className="btn ghost" disabled={pending} onClick={onReset}>Reset to default</button>}
        </div>
      )}
    </form>
  );
}
