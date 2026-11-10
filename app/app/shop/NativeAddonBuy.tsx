'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { purchases, cancelled } from '@/lib/purchasesClient';
import { ADDON_PRODUCTS } from '@/lib/iap';
import { syncPurchases } from '@/app/app/billing';

type Item = { sku: string; label: string; detail: string; cents: number };

/** In the iPhone app, add-ons are consumable App Store purchases. */
export default function NativeAddonBuy({ userId, iosKey, androidKey, items }: { userId: string; iosKey?: string; androidKey?: string; items: Item[] }) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, { price: string; product: any }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const mod: any = await purchases(userId, iosKey, androidKey);
        if (!mod) return;
        const { products } = await mod.Purchases.getProducts({ productIdentifiers: Object.values(ADDON_PRODUCTS), type: mod.PRODUCT_CATEGORY.NON_SUBSCRIPTION });
        const p: Record<string, { price: string; product: any }> = {};
        for (const pr of products || []) p[pr.identifier] = { price: pr.priceString, product: pr };
        setPrices(p);
      } catch (e) { console.warn('[addons]', e); }
    })();
  }, [userId, iosKey, androidKey]);

  const buy = async (sku: string) => {
    const pid = ADDON_PRODUCTS[sku]; const item = prices[pid];
    if (!item) { setMsg({ error: 'That add-on isn’t available in the App Store yet.' }); return; }
    setBusy(sku); setMsg(null);
    try {
      const mod: any = await purchases(userId, iosKey, androidKey);
      await mod.Purchases.purchaseStoreProduct({ product: item.product });
      await syncPurchases('addon');
      setMsg({ ok: 'Added to your account.' });
      router.refresh();
    } catch (e) {
      if (!cancelled(e)) setMsg({ error: 'The purchase didn’t go through. You haven’t been charged.' });
    } finally { setBusy(null); }
  };

  return (
    <div className="stack">
      {msg?.ok && <div className="notice">{msg.ok}</div>}
      {msg?.error && <div className="notice error">{msg.error}</div>}
      {items.map((it) => (
        <div key={it.sku} className="card row">
          <span className="stack grow" style={{ gap: 2 }}><strong>{it.label}</strong><span className="small muted">{it.detail}</span></span>
          <button className="btn sm" disabled={Boolean(busy)} onClick={() => buy(it.sku)}>{busy === it.sku ? '…' : prices[ADDON_PRODUCTS[it.sku]]?.price || `$${(it.cents / 100).toFixed(2)}`}</button>
        </div>
      ))}
    </div>
  );
}
