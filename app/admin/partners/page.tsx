import { requireStaff } from '@/lib/session';
import { deletePartner, savePartner } from './actions';

export const dynamic = 'force-dynamic';

type P = { id: string; slug: string; name: string; tagline: string | null; score_type: string | null; url: string; badge: string | null; sort: number; active: boolean };
type S = { id: string; total: number; d7: number; d30: number; members: number; last: string | null };
type Day = { day: string; n: number };
const ago = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');

function PartnerForm({ p }: { p?: P }) {
  return (
    <form action={savePartner} className="stack" style={{ gap: 10 }}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label className="field grow">Name<input className="input" name="name" required maxLength={80} defaultValue={p?.name || ''} placeholder="Credit Karma" /></label>
        <label className="field" style={{ width: 170 }}>Short name (link)<input className="input" name="slug" maxLength={40} defaultValue={p?.slug || ''} placeholder="credit-karma" /></label>
        <label className="field" style={{ width: 90 }}>Order<input className="input" name="sort" type="number" defaultValue={p?.sort ?? 100} /></label>
      </div>
      <label className="field">Affiliate link<input className="input" name="url" required maxLength={1000} defaultValue={p?.url || ''} placeholder="https://…" /></label>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label className="field grow">Short line<input className="input" name="tagline" maxLength={140} defaultValue={p?.tagline || ''} placeholder="Free scores from TransUnion and Equifax" /></label>
        <label className="field" style={{ width: 160 }}>Score type<input className="input" name="score_type" maxLength={40} defaultValue={p?.score_type || ''} placeholder="VantageScore 3.0" /></label>
        <label className="field" style={{ width: 150 }}>Badge<input className="input" name="badge" maxLength={30} defaultValue={p?.badge || ''} placeholder="Most popular" /></label>
      </div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <label className="choice"><input type="checkbox" name="active" defaultChecked={p ? p.active : true} style={{ accentColor: 'var(--gold)' }} />Show to members</label>
        <button className="btn sm">{p ? 'Save' : 'Add partner'}</button>
      </div>
    </form>
  );
}

/** Credit-score partners shown on the "Share your credit band" step, with click tracking. */
export default async function Partners({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const [{ data, error }, { data: st }] = await Promise.all([
    supabase.from('credit_partners').select('*').order('sort'),
    supabase.rpc('staff_partner_stats'),
  ]);
  const list = (data as P[]) || [];
  const stats = new Map(((st as { partners?: S[] } | null)?.partners || []).map((s) => [s.id, s]));
  const daily = ((st as { daily?: Day[] } | null)?.daily) || [];
  const peak = Math.max(1, ...daily.map((d) => d.n));
  const sum = (k: keyof S) => [...stats.values()].reduce((a, s) => a + Number(s[k] || 0), 0);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h1 className="serif" style={{ fontSize: 36, margin: 0 }}>Credit partners</h1>
        <span className="small muted">Free credit-score services shown on the “Share your credit band” step. Paste each partner’s affiliate link; members tap through /go/short-name, which counts the click and sends them on. Members see a note that ScoreDate may earn a commission.</span>
      </div>
      {(sp.error || error) && <div className="notice error">{sp.error || (/does not exist/.test(error!.message) ? 'Run migration 0061 in the SQL Editor first.' : error!.message)}</div>}
      {sp.saved && <div className="notice">Saved.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {([['Clicks, 7 days', sum('d7')], ['Clicks, 30 days', sum('d30')], ['All-time clicks', sum('total')], ['Members who clicked', sum('members')]] as const).map(([k, v]) => (
          <div key={k} className="card stack" style={{ gap: 4, padding: 14 }}><span className="label">{k}</span><span className="serif" style={{ fontSize: 32 }}>{v}</span></div>
        ))}
      </div>
      {daily.length > 0 && (
        <section className="card stack" style={{ gap: 8 }}>
          <span className="label">Clicks per day, last 30 days</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
            {daily.map((d) => <div key={d.day} title={`${d.day}: ${d.n}`} style={{ flex: 1, height: `${Math.max(3, (d.n / peak) * 100)}%`, background: d.n ? 'var(--gold)' : 'var(--track)', borderRadius: 3 }} />)}
          </div>
        </section>
      )}

      {list.map((p) => {
        const s = stats.get(p.id);
        return (
          <section key={p.id} className="card stack" style={{ gap: 12, opacity: p.active ? 1 : 0.7 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: 8 }}><strong style={{ fontSize: 18 }}>{p.name}</strong><span className="chip small">{p.active ? 'Showing' : 'Hidden'}</span></span>
              <span className="small muted">{s?.d7 ?? 0} this week · {s?.d30 ?? 0} in 30 days · {s?.total ?? 0} all time · {s?.members ?? 0} members · last {ago(s?.last ?? null)}</span>
            </div>
            <PartnerForm p={p} />
            <form action={deletePartner}><input type="hidden" name="id" value={p.id} /><button className="btn ghost sm" style={{ color: 'var(--alert)' }}>Remove</button></form>
          </section>
        );
      })}
      <section className="card stack" style={{ gap: 12 }}>
        <span className="label">Add a partner</span>
        <PartnerForm />
      </section>
    </div>
  );
}
