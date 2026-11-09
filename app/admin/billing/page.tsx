import { supabaseServer } from '@/lib/supabase/server';

export default async function Billing() {
  const supabase = await supabaseServer();
  const [{ data: events }, { data: plans }] = await Promise.all([
    supabase.from('billing_events').select('*').order('received_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('plan, plan_store'),
  ]);
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
      <div className="card scroll-x"><table className="data" style={{ minWidth: 820 }}>
        <thead><tr><th>Received</th><th>Event</th><th>Store</th><th>Product</th><th>Plan after</th><th>Env</th><th>Member</th></tr></thead>
        <tbody>{(events || []).map((e) => <tr key={e.id}><td className="mono small muted">{new Date(e.received_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td><td>{e.type}</td><td className="muted">{e.store}</td><td className="muted small">{e.product_id}</td><td>{e.plan || '—'}</td><td className="muted small">{e.environment}</td><td className="muted small">{e.user_id?.slice(0, 8)}</td></tr>)}</tbody>
      </table></div>
      {(events || []).length === 0 && <p className="small muted">No billing events yet. They appear once RevenueCat is connected and the apps are live.</p>}
    </>
  );
}
