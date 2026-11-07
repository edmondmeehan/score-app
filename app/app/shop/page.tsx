import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { buyAddon, useExtraDrop, useSpotlight } from '../features';

export const dynamic = 'force-dynamic';

type Item = { sku: string; kind: 'extra_drop' | 'spotlight' | 'note'; qty: number; cents: number; label: string; detail: string };
type Mine = { included: boolean; extra_drop: number; spotlight: number; note: number; spotlight_until: string | null };

const price = (c: number) => `$${(c / 100).toFixed(2)}`;

export default async function Shop({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const [{ data: catalog }, { data: mine }, { data: testMode }] = await Promise.all([
    supabase.rpc('addon_catalog'), supabase.rpc('my_addons'), supabase.rpc('test_mode'),
  ]);
  const items = (catalog as Item[]) || [];
  const m = (mine as Mine) || { included: false, extra_drop: 0, spotlight: 0, note: 0, spotlight_until: null };
  const until = m.spotlight_until ? new Date(m.spotlight_until) : null;
  const canUse = me.status === 'active' || me.status === 'preview';

  return (
    <div className="phone">
      <div className="row"><Link href="/app" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link><span className="eyebrow">Add-ons</span></div>
      <h1 className="serif" style={{ fontSize: 40 }}>Stand out a little.</h1>
      <span className="muted small">Optional extras. Nothing here changes anyone&apos;s band or who can see it.</span>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {testMode && !m.included && <div className="notice test">Test mode: purchases are free and no card is charged.</div>}

      {m.included ? (
        <div className="card gold stack" style={{ gap: 6 }}>
          <span className="label">Black</span>
          <span className="serif" style={{ fontSize: 26 }}>Everything here is included.</span>
          <span className="small muted">Use Spotlight, Extra connections and Notes whenever you like.</span>
        </div>
      ) : (
        <div className="card row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
          {([['extra_drop', 'Extra'], ['spotlight', 'Spotlight'], ['note', 'Notes']] as const).map(([k, l]) => (
            <div key={k} className="stack" style={{ gap: 2 }}><span className="serif" style={{ fontSize: 30, color: 'var(--gold-light)' }}>{m[k]}</span><span className="small muted">{l}</span></div>
          ))}
        </div>
      )}

      {canUse && (
        <div className="row" style={{ gap: 10 }}>
          <form action={useExtraDrop} className="grow"><input type="hidden" name="return" value="/app/shop" /><button className="btn ghost block" disabled={!m.included && m.extra_drop < 1}>+5 to today&apos;s Drop</button></form>
          <form action={useSpotlight} className="grow"><input type="hidden" name="return" value="/app/shop" /><button className="btn ghost block" disabled={Boolean(until) || (!m.included && m.spotlight < 1)}>{until ? `On until ${until.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}` : 'Start Spotlight'}</button></form>
        </div>
      )}
      <span className="small muted">Send a Note from anyone&apos;s profile in your Drop.</span>

      {!m.included && (
        <div className="stack">
          {items.map((it) => (
            <form key={it.sku} action={buyAddon} className="card row">
              <input type="hidden" name="sku" value={it.sku} />
              <span className="stack grow" style={{ gap: 2 }}><strong>{it.label}</strong><span className="small muted">{it.detail}</span></span>
              <button className="btn sm">{price(it.cents)}</button>
            </form>
          ))}
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        One-time purchases, no subscription. In the iPhone and Android apps these are bought through the App Store or Google Play.
        Spotlight puts you first in Drops being made for people who match your preferences. It never shows you to someone who blocked you.
      </p>
    </div>
  );
}
