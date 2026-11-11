'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import PageBack from '@/components/PageBack';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { purchases, cancelled } from '@/lib/purchasesClient';
import { SUBSCRIPTIONS, PREVIEW_PRODUCT, MANAGE_SUBSCRIPTIONS_URL } from '@/lib/iap';
import { syncPurchases } from '@/app/app/billing';

type Plan = { key: string; name: string; perks: string };
type Price = Record<string, { price: string; product: any }>;

/** In the iPhone app: real App Store prices, buy with Apple, and Restore purchases (Apple requires it). */
export default function NativePaywall({ userId, iosKey, androidKey, plans, currentPlan, staff = false }: { userId: string; iosKey?: string; androidKey?: string; plans: Plan[]; currentPlan: string; staff?: boolean }) {
  const router = useRouter();
  const [prices, setPrices] = useState<Price>({});
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  // Diagnostics for the ScoreDate team (shown only to staff): what the App Store returned.
  const [diag, setDiag] = useState<string>('');
  const debug = staff;

  useEffect(() => {
    (async () => {
      try {
        const mod = await purchases(userId, iosKey, androidKey);
        if (!mod) { setDiag(`RevenueCat didn’t start (key: ${iosKey ? iosKey.slice(0, 5) + '…' : 'none'})`); setReady(false); return; }
        const { Purchases, PRODUCT_CATEGORY } = mod as any;
        const [subs, once] = await Promise.all([
          Purchases.getProducts({ productIdentifiers: SUBSCRIPTIONS.map((s) => s.id), type: PRODUCT_CATEGORY.SUBSCRIPTION }),
          Purchases.getProducts({ productIdentifiers: [PREVIEW_PRODUCT], type: PRODUCT_CATEGORY.NON_SUBSCRIPTION }),
        ]);
        const p: Price = {};
        for (const pr of [...(subs.products || []), ...(once.products || [])]) p[pr.identifier] = { price: pr.priceString, product: pr };
        setPrices(p); setReady(true);
        const wanted = [...SUBSCRIPTIONS.map((x) => x.id), PREVIEW_PRODUCT];
        const missing = wanted.filter((id) => !p[id]);
        setDiag(`Apple returned ${Object.keys(p).length} of ${wanted.length} products. Key ${iosKey ? iosKey.slice(0, 5) + '…' : 'none'}.${missing.length ? ` Missing: ${missing.map((id) => id.replace('co.please.scoredate.', '')).join(', ')}` : ''}`);
      } catch (e) { console.warn('[paywall]', e); setDiag(`Error: ${(e as Error)?.message || String(e)}`); setReady(false); }
    })();
  }, [userId, iosKey, androidKey]);

  const buy = async (productId: string) => {
    const item = prices[productId];
    if (!item) { setMsg({ error: 'That option isn’t available in the App Store yet. Try again in a minute.' }); return; }
    setBusy(productId); setMsg(null);
    try {
      const mod = await purchases(userId, iosKey, androidKey);
      await (mod as any).Purchases.purchaseStoreProduct({ product: item.product });
      const r = await syncPurchases('plan');
      if (r.error) setMsg({ ok: 'Thank you! Your purchase went through. It can take a minute to show up.' });
      router.push('/app?welcome=1');
    } catch (e) {
      if (!cancelled(e)) setMsg({ error: 'The purchase didn’t go through. You haven’t been charged.' });
    } finally { setBusy(null); }
  };

  const restore = async () => {
    setBusy('restore'); setMsg(null);
    try {
      const mod = await purchases(userId, iosKey, androidKey);
      await (mod as any).Purchases.restorePurchases();
      const r = await syncPurchases('restore');
      if (r.plan && r.plan !== 'none' && r.plan !== 'unknown') { router.push('/app'); return; }
      setMsg({ ok: 'No active ScoreDate subscription was found for this Apple ID.' });
    } catch { setMsg({ error: 'Couldn’t reach the App Store. Try again.' }); }
    finally { setBusy(null); }
  };

  const sub = (plan: string) => SUBSCRIPTIONS.find((s) => s.plan === plan && s.period === (annual ? 'year' : 'month')) || SUBSCRIPTIONS.find((s) => s.plan === plan)!;
  const isCurrent = (plan: string) => currentPlan === plan;

  return (
    <div className="phone">
      <PageBack />
        <h1 className="serif" style={{ fontSize: 36 }}>Become a member</h1>
      {debug && <div className="card small mono" style={{ wordBreak: 'break-word' }}><strong>Team only:</strong> {diag || 'Checking the App Store…'}</div>}
      {ready === false && <div className="notice">The App Store isn’t available right now. Check your connection and try again.</div>}
      <div className="row" role="tablist" style={{ gap: 6, padding: 4, borderRadius: 999, border: '1px solid var(--line-soft)', alignSelf: 'flex-start' }}>
        {[['Monthly', false], ['Annual', true]].map(([l, v]) => (
          <button key={String(l)} type="button" role="tab" aria-selected={annual === v} onClick={() => setAnnual(Boolean(v))} className={`btn sm ${annual === v ? '' : 'ghost'}`} style={{ border: 0 }}>{l}</button>
        ))}
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {plans.map((p) => {
          const s = sub(p.key);
          const price = prices[s.id]?.price || s.price;
          const period = s.period === 'year' ? '/yr' : '/mo';
          return (
            <div key={p.key} className="card stack" style={{ gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><strong>{p.name}</strong><strong>{price}{period}</strong></div>
              <span className="small muted">{p.perks}{p.key === 'black' && annual ? ' · Monthly only' : ''}</span>
              <button className="btn block" disabled={Boolean(busy) || isCurrent(p.key)} onClick={() => buy(s.id)}>
                {isCurrent(p.key) ? 'Your plan' : busy === s.id ? 'Opening the App Store…' : `Subscribe for ${price}${period}`}
              </button>
            </div>
          );
        })}
        <div className="card stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><strong>Preview</strong><strong>{prices[PREVIEW_PRODUCT]?.price || '$9.99'} once</strong></div>
          <span className="small muted">30 days, 5 matches you can view but not message. Doesn’t renew.</span>
          <button className="btn ghost block" disabled={Boolean(busy) || currentPlan === 'preview'} onClick={() => buy(PREVIEW_PRODUCT)}>{busy === PREVIEW_PRODUCT ? 'Opening the App Store…' : 'Try Preview'}</button>
        </div>
      </div>
      {msg?.ok && <div className="notice">{msg.ok}</div>}
      {msg?.error && <div className="notice error">{msg.error}</div>}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className="btn ghost sm" disabled={Boolean(busy)} onClick={restore}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</button>
        <a className="btn ghost sm" href={MANAGE_SUBSCRIPTIONS_URL}>Manage subscription</a>
      </div>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Payment is charged to your Apple ID when you confirm. Subscriptions renew automatically at the same price unless cancelled at least 24 hours before the end of the current period. Manage or cancel any time in your App Store account settings. <a href="/legal/terms">Terms of Use</a> · <a href="/legal/privacy">Privacy Policy</a>
      </p>
    </div>
  );
}
