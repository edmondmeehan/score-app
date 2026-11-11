'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import PageBack from '@/components/PageBack';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { purchases, cancelled } from '@/lib/purchasesClient';
import { SUBSCRIPTIONS, PREVIEW_PRODUCTS, LIFETIME_PRODUCT, LIFETIME_PRODUCT_2, LIFETIME_PRODUCTS, MANAGE_SUBSCRIPTIONS_URL } from '@/lib/iap';
import { syncPurchases } from '@/app/app/billing';
import { haptic } from '@/lib/haptics';

type Plan = { key: string; name: string; perks: string };
type Price = Record<string, { price: string; product: any }>;
type Lifetime = { enabled: boolean; cap: number; sold: number; left: number; price: string; mine: string | null; early_cap?: number; early_left?: number; price2?: string; tier?: number } | null;

/** In the iPhone app: real App Store prices, buy with Apple, and Restore purchases (Apple requires it). */
export default function NativePaywall({ userId, iosKey, androidKey, plans, currentPlan, staff = false, lifetime = null }: { userId: string; iosKey?: string; androidKey?: string; plans: Plan[]; currentPlan: string; staff?: boolean; lifetime?: Lifetime }) {
  const router = useRouter();
  const [prices, setPrices] = useState<Price>({});
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  // After a purchase: a confirmation screen instead of jumping away.
  const [done, setDone] = useState<{ title: string; detail: string } | null>(null);
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
          Purchases.getProducts({ productIdentifiers: [...PREVIEW_PRODUCTS, ...LIFETIME_PRODUCTS], type: PRODUCT_CATEGORY.NON_SUBSCRIPTION }),
        ]);
        const p: Price = {};
        for (const pr of [...(subs.products || []), ...(once.products || [])]) p[pr.identifier] = { price: pr.priceString, product: pr };
        // Preview: use whichever Preview ID Apple returned.
        const pv = PREVIEW_PRODUCTS.find((id) => p[id]);
        if (pv) p.__preview = p[pv];
        setPrices(p); setReady(true);
        const wanted = [...SUBSCRIPTIONS.map((x) => x.id), 'preview'];
        const missing = wanted.filter((id) => (id === 'preview' ? !pv : !p[id]));
        setDiag(`Apple returned ${wanted.length - missing.length} of ${wanted.length} products${pv ? ` (Preview: ${pv.replace('co.please.scoredate.', '')})` : ''}. Key ${iosKey ? iosKey.slice(0, 5) + '…' : 'none'}.${` Lifetime: early ${p[LIFETIME_PRODUCT] ? 'yes' : 'not in store'}, regular ${p[LIFETIME_PRODUCT_2] ? 'yes' : 'not in store'}.`}${missing.length ? ` Missing: ${missing.map((id) => id.replace('co.please.scoredate.', '')).join(', ')}` : ''}`);
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
      await syncPurchases('plan').catch(() => null);
      haptic('success');
      const RANK = ['none', 'preview', 'paused', 'membership', 'premium', 'black'];
      const isPreview = productId === '__preview';
      if (LIFETIME_PRODUCTS.includes(productId)) {
        setDone({ title: 'Welcome, Founding Lifetime member', detail: 'Premium is yours for as long as ScoreDate runs. No renewals, nothing more to pay. If you had a subscription, cancel it in your App Store settings so you’re not billed again.' });
        router.refresh();
        return;
      }
      const sub = SUBSCRIPTIONS.find((x) => x.id === productId);
      const name = isPreview ? 'Preview' : plans.find((p) => p.key === sub?.plan)?.name || 'your new plan';
      const downgrade = !isPreview && sub && RANK.indexOf(sub.plan) < RANK.indexOf(currentPlan) && currentPlan !== 'none';
      setDone({
        title: isPreview ? 'Your Preview has started' : downgrade ? `You’re switching to ${name}` : `Welcome to ${name}`,
        detail: isPreview
          ? 'You have 30 days to see your matches. It won’t renew.'
          : downgrade
            ? `Apple keeps your current plan until the end of this billing period, then switches you to ${name}. You won’t be charged twice.`
            : `Your ${name} membership is active${sub ? ` and renews ${sub.period === 'year' ? 'yearly' : 'monthly'} until you cancel` : ''}. A receipt is on its way from Apple.`,
      });
      router.refresh();
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
    done ? (
      <div className="phone" style={{ justifyContent: 'center' }}>
        <div className="card gold stack" style={{ gap: 14, textAlign: 'center', alignItems: 'center', padding: 28 }}>
          <span style={{ fontSize: 44, color: 'var(--gold)' }} aria-hidden="true">✓</span>
          <span className="serif" style={{ fontSize: 32 }}>{done.title}</span>
          <span className="small muted" style={{ lineHeight: 1.5 }}>{done.detail}</span>
          {staff && <span className="small muted">Your team account always has full access, so it keeps showing Reserve.</span>}
          <a className="btn block" href="/app?welcome=1">Continue</a>
          <a className="small" href={MANAGE_SUBSCRIPTIONS_URL}>Manage subscription</a>
        </div>
      </div>
    ) : (
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
      {lifetime?.mine && (
        <div className="card gold stack" style={{ gap: 6 }}>
          <span className="eyebrow">Founding Lifetime</span>
          <span className="serif" style={{ fontSize: 24 }}>Premium is yours for life.</span>
          <span className="small muted">Thanks for being one of the first {lifetime.cap}.</span>
        </div>
      )}
      {(() => {
        if (!lifetime || lifetime.mine || !lifetime.enabled || lifetime.left <= 0) return null;
        const early = (lifetime.tier ?? 1) === 1;
        const lp = early ? LIFETIME_PRODUCT : LIFETIME_PRODUCT_2;
        if (!prices[lp]) return null;
        return (
          <div className="card gold stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="eyebrow">Founding Lifetime</span><span className="small" style={{ color: 'var(--gold-light)', fontWeight: 600 }}>{lifetime.left} of {lifetime.cap} left</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><strong>Premium for life</strong><strong>{prices[lp].price} once</strong></div>
            {early && <span className="small" style={{ color: 'var(--gold-light)' }}>Early price for the first {lifetime.early_cap}: {lifetime.early_left} left, then {prices[LIFETIME_PRODUCT_2]?.price || lifetime.price2}.</span>}
            <span className="small muted">Everything in Premium for as long as ScoreDate runs. Pay once, never renew. Only {lifetime.cap} will ever be sold.</span>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--track)' }}><div style={{ height: 6, borderRadius: 3, width: `${Math.min(100, (lifetime.sold / Math.max(1, lifetime.cap)) * 100)}%`, background: 'var(--gold)' }} /></div>
            <button className="btn block" disabled={Boolean(busy)} onClick={() => buy(lp)}>{busy === lp ? 'Opening the App Store…' : `Become a Founding member · ${prices[lp].price}`}</button>
          </div>
        );
      })()}
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
          <div className="row" style={{ justifyContent: 'space-between' }}><strong>Preview</strong><strong>{prices.__preview?.price || '$9.99'} once</strong></div>
          <span className="small muted">30 days, 5 matches you can view but not message. Doesn’t renew.</span>
          <button className="btn ghost block" disabled={Boolean(busy) || currentPlan === 'preview'} onClick={() => buy('__preview')}>{busy === '__preview' ? 'Opening the App Store…' : 'Try Preview'}</button>
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
    )
  );
}
