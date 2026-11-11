import { supabaseServer } from '@/lib/supabase/server';
import { saveLifetimeOffer } from './actions';

export default async function Billing({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: events }, { data: plans }, { data: lt }, { data: buyers }, { data: role }] = await Promise.all([
    supabase.from('billing_events').select('*').order('received_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('plan, plan_store'),
    supabase.rpc('lifetime_status'),
    supabase.from('profiles').select('id, first_name, lifetime_at').not('lifetime_at', 'is', null).order('lifetime_at'),
    supabase.rpc('staff_role'),
  ]);
  const life = (lt as { enabled: boolean; cap: number; sold: number; left: number; price: string; early_cap?: number; early_left?: number; price2?: string; tier?: number } | null) || { enabled: false, cap: 100, sold: 0, left: 100, price: '$499', early_cap: 25, early_left: 25, price2: '$749', tier: 1 };
  const count = (fn: (p: { plan: string; plan_store: string | null }) => boolean) => (plans || []).filter(fn).length;
  const tiles = [
    ['Membership', count((p) => p.plan === 'membership')], ['Premium', count((p) => p.plan === 'premium')], ['Reserve', count((p) => p.plan === 'black')], ['Paused', count((p) => p.plan === 'paused')],
    ['Via App Store', count((p) => p.plan_store === 'APP_STORE')], ['Via Google Play', count((p) => p.plan_store === 'PLAY_STORE')],
  ] as const;
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Billing</h1>
      <p className="muted" style={{ margin: 0 }}>Purchases from the iPhone and Android apps arrive through RevenueCat. Refunds and cancellations are handled by Apple and Google; changes show up here automatically.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {tiles.map(([l, v]) => <div key={l} className="card stack" style={{ gap: 6 }}><span className="small muted">{l}</span><span className="serif" style={{ fontSize: 32 }}>{v}</span></div>)}
      </div>
      <section id="lifetime" className="card stack" style={{ gap: 12, scrollMarginTop: 24 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="stack" style={{ gap: 2 }}><span className="label">Founding Lifetime</span><span className="serif" style={{ fontSize: 28 }}>{life.sold} of {life.cap} sold · {life.left} left</span></div>
          <span className="small" style={{ color: life.enabled ? 'var(--rise)' : 'var(--faint)' }}>{life.enabled ? 'On sale in the app' : 'Off'}</span>
        </div>
        <span className="small muted">One-time App Store purchase that unlocks Premium for as long as ScoreDate runs. The first {life.early_cap} sell at the early price (product co.please.scoredate.lifetime.premium), the rest at the regular price (co.please.scoredate.lifetime.premium.tier2). Now selling: {life.tier === 1 ? `early price, ${life.early_left} left` : 'regular price'}. The app stops showing it once the cap is reached.</span>
        {sp.saved && <div className="notice">Saved.</div>}
        {sp.error && <div className="notice error">{sp.error}</div>}
        {role === 'owner' && (
          <form action={saveLifetimeOffer} className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="row small"><input type="checkbox" name="enabled" defaultChecked={life.enabled} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />On sale</label>
            <label className="field" style={{ width: 120 }}>Cap<input className="input" name="cap" type="number" min={0} max={10000} defaultValue={life.cap} /></label>
            <label className="field" style={{ width: 120 }}>Early spots<input className="input" name="early_cap" type="number" min={0} max={10000} defaultValue={life.early_cap ?? 25} /></label>
            <label className="field" style={{ width: 120 }}>Early price<input className="input" name="price" defaultValue={life.price} /></label>
            <label className="field" style={{ width: 120 }}>Regular price<input className="input" name="price2" defaultValue={life.price2 ?? '$749'} /></label>
            <button className="btn sm">Save</button>
          </form>
        )}
        {(buyers || []).length > 0 && <div className="small">{(buyers || []).map((b, i) => <div key={b.id}>#{i + 1} · <a href={`/admin/members/${b.id}`}>{b.first_name || b.id.slice(0, 8)}</a> · {new Date(b.lifetime_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</div>)}</div>}
      </section>
      <div className="card scroll-x"><table className="data" style={{ minWidth: 820 }}>
        <thead><tr><th>Received</th><th>Event</th><th>Store</th><th>Product</th><th>Plan after</th><th>Env</th><th>Member</th></tr></thead>
        <tbody>{(events || []).map((e) => <tr key={e.id}><td className="mono small muted">{new Date(e.received_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td><td>{e.type}</td><td className="muted">{e.store}</td><td className="muted small">{e.product_id}</td><td>{e.plan || '—'}</td><td className="muted small">{e.environment}</td><td className="muted small">{e.user_id?.slice(0, 8)}</td></tr>)}</tbody>
      </table></div>
      {(events || []).length === 0 && <p className="small muted">No billing events yet. They appear once RevenueCat is connected and the apps are live.</p>}
    </>
  );
}
