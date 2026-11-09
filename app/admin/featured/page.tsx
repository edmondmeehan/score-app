import { requireStaff } from '@/lib/session';
import PlaceFields from '@/components/PlaceFields';
import { deleteSpot, saveSpot } from './actions';

export const dynamic = 'force-dynamic';

type Spot = { id: string; name: string; place_id: string | null; address: string | null; lat: number | null; lng: number | null; neighborhood: string | null; blurb: string | null; perk: string | null; badge: string; priority: number; active: boolean; starts_on: string | null; ends_on: string | null; monthly_fee: number | null; contact_name: string | null; contact_email: string | null; notes: string | null };
type Stat = { id: string; views: number; members: number; clicks: number; reserve: number; plans: number; accepted: number };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const usd = (n: number | null) => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);

function SpotForm({ s }: { s?: Spot }) {
  return (
    <form action={saveSpot} className="stack" style={{ gap: 10 }}>
      {s && <input type="hidden" name="id" value={s.id} />}
      <PlaceFields nameField="name" nameLabel="Venue" namePlaceholder="Search the restaurant or bar" addressLabel="Address" defaults={s ? { name: s.name, address: s.address || '', place_id: s.place_id || '', lat: s.lat, lng: s.lng } : {}} />
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label className="field grow">Neighborhood<input className="input" name="neighborhood" maxLength={80} defaultValue={s?.neighborhood || ''} placeholder="West Village" /></label>
        <label className="field" style={{ width: 170 }}>Badge<input className="input" name="badge" maxLength={30} defaultValue={s?.badge || 'ScoreDate Partner'} /></label>
        <label className="field" style={{ width: 110 }}>Priority<input className="input" name="priority" type="number" defaultValue={s?.priority ?? 0} /></label>
      </div>
      <label className="field">Member perk (optional)<input className="input" name="perk" maxLength={140} defaultValue={s?.perk || ''} placeholder="Free glass of bubbly for ScoreDate couples" /></label>
      <label className="field">Short line (optional)<input className="input" name="blurb" maxLength={160} defaultValue={s?.blurb || ''} placeholder="Candlelit natural wine bar, perfect for a first date" /></label>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label className="field">Starts<input className="input" type="date" name="starts_on" defaultValue={s?.starts_on || ''} /></label>
        <label className="field">Ends<input className="input" type="date" name="ends_on" defaultValue={s?.ends_on || ''} /></label>
        <label className="field" style={{ width: 140 }}>Monthly fee ($)<input className="input" name="monthly_fee" inputMode="decimal" defaultValue={s?.monthly_fee ?? ''} /></label>
      </div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label className="field grow">Contact name<input className="input" name="contact_name" maxLength={80} defaultValue={s?.contact_name || ''} /></label>
        <label className="field grow">Contact email<input className="input" type="email" name="contact_email" maxLength={160} defaultValue={s?.contact_email || ''} /></label>
      </div>
      <label className="field">Internal notes<textarea className="input" name="notes" rows={2} maxLength={1000} defaultValue={s?.notes || ''} /></label>
      <label className="choice"><input type="checkbox" name="active" defaultChecked={s ? s.active : true} style={{ accentColor: 'var(--gold)' }} /> Live (shows to members between the start and end dates)</label>
      <button className="btn sm" style={{ alignSelf: 'flex-start' }}>{s ? 'Save' : 'Add featured spot'}</button>
    </form>
  );
}

export default async function Featured({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : iso(new Date());
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : iso(new Date(Date.now() - 29 * 86400000));
  const [{ data: spots, error }, { data: report }] = await Promise.all([
    supabase.from('featured_spots').select('*').order('active', { ascending: false }).order('priority', { ascending: false }).order('created_at'),
    supabase.rpc('staff_featured_report', { p_from: from, p_to: to }),
  ]);
  const stats = new Map(((report as Stat[]) || []).map((r) => [r.id, r]));
  const list = (spots as Spot[] | null) || [];
  const today = iso(new Date());
  const live = (s: Spot) => s.active && (!s.starts_on || s.starts_on <= today) && (!s.ends_on || s.ends_on >= today);
  const mrr = list.filter(live).reduce((t, s) => t + Number(s.monthly_fee || 0), 0);

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Featured spots</h1>
      <span className="small muted">Venues that pay to appear first in Suggest a date as “ScoreDate Partners”, with an optional perk for members. Tracking: how many members saw the pick, tapped it, tapped its menu or reservation links, and how many dates were suggested and accepted there.</span>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {error && /relation|schema/.test(error.message) && <div className="notice error">Run migration 0040 in the ScoreDate SQL Editor first.</div>}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        {[[String(list.filter(live).length), 'Live now', `${list.length} total`], [usd(mrr), 'Monthly revenue', 'From live spots']].map(([n, l, s]) => (
          <div key={l} className="card stack" style={{ gap: 4, flex: '1 1 160px' }}><span className="serif" style={{ fontSize: 30, lineHeight: 1 }}>{n}</span><span className="small">{l}</span><span className="small muted">{s}</span></div>
        ))}
      </div>

      <form className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="stack small" style={{ gap: 4 }}>From<input className="input" type="date" name="from" defaultValue={from} /></label>
        <label className="stack small" style={{ gap: 4 }}>To<input className="input" type="date" name="to" defaultValue={to} /></label>
        <button className="btn ghost sm">Update</button>
      </form>

      <section className="card scroll-x" style={{ overflowX: 'auto' }}>
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>Venue</th><th>Status</th><th>Fee/mo</th><th>Members reached</th><th>Taps</th><th>Menu / reserve taps</th><th>Dates suggested</th><th>Dates accepted</th></tr></thead>
          <tbody>
            {list.map((s) => { const r = stats.get(s.id); return (
              <tr key={s.id}><td><strong>{s.name}</strong>{s.neighborhood ? <span className="small muted"> · {s.neighborhood}</span> : null}</td><td className="small">{live(s) ? 'Live' : s.active ? 'Scheduled / ended' : 'Off'}</td><td>{usd(s.monthly_fee)}</td><td>{r?.members ?? 0}</td><td>{r?.clicks ?? 0}</td><td>{r?.reserve ?? 0}</td><td>{r?.plans ?? 0}</td><td>{r?.accepted ?? 0}</td></tr>
            ); })}
            {list.length === 0 && <tr><td colSpan={8} className="small muted">No featured spots yet. Add the first one below.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <strong>Add a featured spot</strong>
        <SpotForm />
      </section>

      {list.map((s) => (
        <details key={s.id} className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{s.name} <span className="small muted">· {live(s) ? 'Live' : 'Not live'}{s.perk ? ` · Perk: ${s.perk}` : ''}</span></summary>
          <div className="stack" style={{ gap: 12, marginTop: 12 }}>
            <SpotForm s={s} />
            <form action={deleteSpot}><input type="hidden" name="id" value={s.id} /><button className="btn ghost sm" style={{ color: 'var(--alert)' }}>Remove spot</button></form>
          </div>
        </details>
      ))}
    </>
  );
}
