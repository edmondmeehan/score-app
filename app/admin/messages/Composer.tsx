'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOOKING_FOR, PETS, WANTS_KIDS } from '@/lib/profileDetails';
import { MONEY_QUESTIONS } from '@/lib/types';
import { previewAudience, saveCampaign, sendCampaign, type Filters, type Preview } from './actions';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const PLANS: [string, string][] = [['preview', 'Preview'], ['membership', 'Membership'], ['premium', 'Premium'], ['black', 'Reserve']];
const BANDS: [string, string][] = [['building', 'Building'], ['solid', 'Solid'], ['strong', 'Strong'], ['elite', 'Elite']];
const GENDERS: [string, string][] = [['woman', 'Women'], ['man', 'Men'], ['nonbinary', 'Nonbinary']];
const DEST: [string, string][] = [['/app', 'Daily Drop'], ['/app/discover', 'Discover'], ['/app/events', 'Events'], ['/app/giveaways', 'Giveaways'], ['/app/messages', 'Messages'], ['/app/profile', 'Their profile'], ['/app/invites', 'Invites'], ['/app/shop', 'Add-ons']];

function Chips({ label, options, value, onChange }: { label: string; options: readonly (readonly [string, string])[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="small muted">{label}</span>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {options.map(([k, l]) => {
          const on = value.includes(k);
          return <button key={k} type="button" className="chip" onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}
            style={{ cursor: 'pointer', fontSize: 12, padding: '6px 10px', background: on ? 'var(--gold-wash)' : 'transparent', borderColor: on ? 'var(--gold)' : undefined, color: on ? 'var(--gold-light)' : undefined }}>{l}</button>;
        })}
      </div>
    </div>
  );
}

export default function Composer() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/app/discover');
  const [channels, setChannels] = useState<string[]>(['inapp', 'push']);
  const [f, setF] = useState<Filters>({ include_test: true });
  const [when, setWhen] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [res, setRes] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, v: Filters[string]) => setF((x) => ({ ...x, [k]: v }));
  const arr = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []);
  const key = useMemo(() => JSON.stringify(f), [f]);

  useEffect(() => {
    const t = setTimeout(() => { previewAudience(f).then((r) => ('error' in r ? setRes({ error: r.error }) : setPreview(r))); }, 400);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const draft = () => ({ title, body, url, channels, filters: f, scheduled_at: when ? new Date(when).toISOString() : '' });
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, reset = false) => start(async () => {
    const r = await fn(); setRes(r);
    if (r.ok && reset) { setTitle(''); setBody(''); setWhen(''); router.refresh(); }
  });
  const reach = preview ? Math.max(0, preview.count - preview.capped) : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
      <section className="card stack" style={{ gap: 14 }}>
        <strong>Who gets it</strong>
        <Chips label="Borough" options={BOROUGHS.map((b) => [b, b] as const)} value={arr('boroughs')} onChange={(v) => set('boroughs', v)} />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label className="field grow">Neighborhood contains<input className="input" value={(f.neighborhood as string) || ''} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Williamsburg" /></label>
          <label className="field" style={{ width: 110 }}>Near ZIP<input className="input" inputMode="numeric" maxLength={5} value={(f.center_zip as string) || ''} onChange={(e) => set('center_zip', e.target.value.replace(/\D/g, ''))} placeholder="10014" /></label>
          <label className="field" style={{ width: 100 }}>Within (mi)<input className="input" type="number" min={0.5} step={0.5} value={(f.radius_miles as string) || ''} onChange={(e) => set('radius_miles', e.target.value)} placeholder="2" /></label>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="field grow">Age from<input className="input" type="number" min={25} max={99} value={(f.age_min as string) || ''} onChange={(e) => set('age_min', e.target.value)} placeholder="25" /></label>
          <label className="field grow">to<input className="input" type="number" min={25} max={99} value={(f.age_max as string) || ''} onChange={(e) => set('age_max', e.target.value)} placeholder="45" /></label>
        </div>
        <Chips label="Gender" options={GENDERS} value={arr('genders')} onChange={(v) => set('genders', v)} />
        <Chips label="Plan" options={PLANS} value={arr('plans')} onChange={(v) => set('plans', v)} />
        <Chips label="Credit band" options={BANDS} value={arr('bands')} onChange={(v) => set('bands', v)} />
        <Chips label="Looking for" options={LOOKING_FOR} value={arr('looking_for')} onChange={(v) => set('looking_for', v)} />
        <Chips label="Money answers (any of)" options={MONEY_QUESTIONS.flatMap((q) => q.options).map((o) => [o, o] as const)} value={arr('money_values')} onChange={(v) => set('money_values', v)} />
        <Chips label="Pets" options={PETS} value={arr('pets')} onChange={(v) => set('pets', v)} />
        <Chips label="Kids" options={WANTS_KIDS} value={arr('wants_kids')} onChange={(v) => set('wants_kids', v)} />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label className="field grow">Spotify artist<input className="input" value={(f.artist as string) || ''} onChange={(e) => set('artist', e.target.value)} placeholder="Taylor Swift" /></label>
          <label className="field grow">My NYC spot<input className="input" value={(f.spot as string) || ''} onChange={(e) => set('spot', e.target.value)} placeholder="Prospect Park" /></label>
          <label className="field grow">Interest word<input className="input" value={(f.interest as string) || ''} onChange={(e) => set('interest', e.target.value)} placeholder="wine, running, concerts" /></label>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="field grow">Active in last (days)<input className="input" type="number" min={1} value={(f.active_days as string) || ''} onChange={(e) => set('active_days', e.target.value)} placeholder="7" /></label>
          <label className="field grow">Away for at least (days)<input className="input" type="number" min={1} value={(f.inactive_days as string) || ''} onChange={(e) => set('inactive_days', e.target.value)} placeholder="14" /></label>
        </div>
        <div className="row small" style={{ gap: 16, flexWrap: 'wrap' }}>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={Boolean(f.founders)} onChange={(e) => set('founders', e.target.checked)} style={{ accentColor: 'var(--gold)' }} />Founding Members only</label>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={Boolean(f.attended_event)} onChange={(e) => set('attended_event', e.target.checked)} style={{ accentColor: 'var(--gold)' }} />Came to an event</label>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={f.include_test !== false} onChange={(e) => set('include_test', e.target.checked)} style={{ accentColor: 'var(--gold)' }} />Include test accounts</label>
        </div>
      </section>

      <div className="stack" style={{ gap: 16, position: 'sticky', top: 16 }}>
        <section className="card gold stack" style={{ gap: 4 }}>
          <span className="label">Audience</span>
          <span className="serif" style={{ fontSize: 40, lineHeight: 1 }}>{reach ?? '…'}</span>
          <span className="small muted">{preview ? `${preview.count} match${preview.capped ? `, ${preview.capped} skipped (messaged in the last 3 days)` : ''}` : 'Counting…'}</span>
          {preview && preview.sample.length > 0 && <span className="small muted" style={{ marginTop: 4 }}>e.g. {preview.sample.join(', ')}</span>}
        </section>

        <section className="card stack" style={{ gap: 12 }}>
          <strong>Message</strong>
          <label className="field">Title ({80 - title.length})<input className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wine night in Williamsburg 🍷" /></label>
          <label className="field">Message ({200 - body.length})<textarea className="input" rows={3} maxLength={200} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Twenty members, one long table, Thursday at 7. Tap to RSVP." /></label>
          <label className="field">Tapping it opens
            <select className="input" value={url} onChange={(e) => setUrl(e.target.value)}>{DEST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <div className="stack" style={{ gap: 6 }}>
            <span className="small muted">Send as</span>
            <div className="row small" style={{ gap: 16, flexWrap: 'wrap' }}>
              {([['inapp', 'In-app (Activity)'], ['push', 'Push notification'], ['email', 'Email']] as [string, string][]).map(([k, l]) => (
                <label key={k} className="row" style={{ gap: 8 }}><input type="checkbox" checked={channels.includes(k)} onChange={(e) => setChannels((c) => e.target.checked ? [...c, k] : c.filter((x) => x !== k))} style={{ accentColor: 'var(--gold)' }} />{l}</label>
              ))}
            </div>
          </div>
          {(title || body) && (
            <div className="stack" style={{ gap: 2, padding: 12, borderRadius: 16, background: 'var(--onyx)', border: '1px solid var(--line-soft)' }}>
              <span className="small muted" style={{ fontSize: 11 }}>SCOREDATE · now</span>
              <strong className="small">{title || 'Title'}</strong>
              <span className="small">{body || 'Your message'}</span>
            </div>
          )}
          <label className="field">Schedule (optional, New York time)<input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          {res?.ok && <div className="notice">{res.ok}</div>}
          {res?.error && <div className="notice error">{res.error}</div>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => sendCampaign(draft(), true))}>Send me a test</button>
            {when
              ? <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => saveCampaign(draft()), true)}>Schedule</button>
              : <button type="button" className="btn sm" disabled={pending || !reach} onClick={() => { if (confirm(`Send “${title}” to ${reach} member${reach === 1 ? '' : 's'} now?`)) run(() => sendCampaign(draft(), false), true); }}>Send to {reach ?? 0}</button>}
          </div>
        </section>
      </div>
    </div>
  );
}
