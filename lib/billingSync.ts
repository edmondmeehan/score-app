import 'server-only';
import { getIntegration } from '@/lib/integrations';
import { planFromEntitlements } from '@/lib/revenuecat';
import { supabaseAnon } from '@/lib/supabase/server';
import { PREVIEW_PRODUCT, PREVIEW_PRODUCTS, skuForProduct } from '@/lib/iap';

type Sub = { expires_date?: string | null; is_sandbox?: boolean; store?: string; purchase_date?: string };
type NonSub = { id?: string; store_transaction_id?: string; purchase_date?: string; is_sandbox?: boolean; store?: string };

/**
 * Right after a purchase or "Restore purchases" in the app: ask RevenueCat what this member owns and apply it now,
 * instead of waiting for the webhook. Safe to run any time; add-ons are granted once per store transaction.
 */
export async function syncFromStore(userId: string): Promise<{ plan: string; addons: number; error?: string }> {
  const rc = await getIntegration('revenuecat');
  if (!rc.secrets.secret_api_key) return { plan: 'unknown', addons: 0, error: 'RevenueCat isn’t connected yet' };
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${rc.secrets.secret_api_key}` }, cache: 'no-store',
  });
  if (!res.ok) return { plan: 'unknown', addons: 0, error: `RevenueCat ${res.status}` };
  const s = (await res.json())?.subscriber || {};
  const now = Date.now();
  const ents = Object.entries((s.entitlements || {}) as Record<string, { expires_date?: string | null; product_identifier?: string }>)
    .filter(([, e]) => !e.expires_date || new Date(e.expires_date).getTime() > now);
  let plan: string = await planFromEntitlements(ents.map(([k]) => k));
  const subs = (s.subscriptions || {}) as Record<string, Sub>;
  const activeSub = ents.map(([, e]) => subs[e.product_identifier || '']).find(Boolean);
  const nonSubs = (s.non_subscriptions || {}) as Record<string, NonSub[]>;
  const sb = supabaseAnon(); const secret = process.env.SCORE_SERVER_SECRET;

  // Preview: a one-time purchase in the last 30 days counts if there's no subscription.
  const preview = PREVIEW_PRODUCTS.flatMap((id) => nonSubs[id] || []).find((p) => p.purchase_date && now - new Date(p.purchase_date).getTime() < 31 * 86400000);
  if (plan === 'none' && preview) plan = 'preview';

  if (plan !== 'none') {
    await sb.rpc('record_billing_event', {
      p_server_secret: secret, p_event_id: `app_sync:${userId}:${now}`, p_user: userId, p_type: 'APP_SYNC',
      p_store: activeSub?.store || preview?.store || 'app_store', p_product: ents[0]?.[1]?.product_identifier || (preview ? PREVIEW_PRODUCT : null),
      p_entitlement: ents[0]?.[0] || null, p_plan: plan, p_expires: activeSub?.expires_date || null,
      p_environment: (activeSub?.is_sandbox ?? preview?.is_sandbox) ? 'SANDBOX' : 'PRODUCTION',
    });
  }

  // Add-ons (consumables): grant each store transaction once; the webhook uses the same reference.
  let addons = 0;
  const { data: testMode } = await sb.rpc('test_mode');
  for (const [productId, list] of Object.entries(nonSubs)) {
    const sku = skuForProduct(productId);
    if (!sku) continue;
    for (const t of list) {
      if (t.is_sandbox && !testMode) continue; // TestFlight purchases only count while test mode is on
      const ref = t.store_transaction_id || t.id;
      if (!ref) continue;
      const { error } = await sb.rpc('grant_addon', { p_secret: secret, p_user: userId, p_sku: sku, p_source: 'apple', p_ref: String(ref) });
      if (!error) addons++;
    }
  }
  return { plan, addons };
}
