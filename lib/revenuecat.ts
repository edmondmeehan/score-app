import 'server-only';
import { getIntegration } from '@/lib/integrations';
import { PREVIEW_PRODUCT } from '@/lib/iap';

const RANK = ['none', 'preview', 'paused', 'membership', 'premium', 'black'] as const;
export type Plan = (typeof RANK)[number];

/** Map active entitlement IDs (as named in RevenueCat) to ScoreDate's highest plan. */
export async function planFromEntitlements(active: string[]): Promise<Plan> {
  const rc = await getIntegration('revenuecat');
  const map: Record<string, string> = rc.config.entitlements || {};
  let best: Plan = 'none';
  for (const [plan, ent] of Object.entries(map)) {
    if (active.includes(ent) && RANK.indexOf(plan as Plan) > RANK.indexOf(best)) best = plan as Plan;
  }
  return best;
}

/** Is this product the one-time $9.99 Preview purchase (Apple or Google)? */
export async function isPreviewProduct(productId: string | null | undefined) {
  if (!productId) return false;
  const [apple, google] = await Promise.all([getIntegration('apple'), getIntegration('google')]);
  return [PREVIEW_PRODUCT, apple.config.products?.preview_once, google.config.products?.preview_once].filter(Boolean).includes(productId);
}

/** Ask RevenueCat for the subscriber's current entitlements (source of truth). */
export async function activeEntitlements(appUserId: string): Promise<string[] | null> {
  const rc = await getIntegration('revenuecat');
  if (!rc.secrets.secret_api_key) return null;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${rc.secrets.secret_api_key}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = await res.json();
  const ents = body?.subscriber?.entitlements || {};
  const now = Date.now();
  return Object.entries(ents)
    .filter(([, e]: [string, any]) => !e.expires_date || new Date(e.expires_date).getTime() > now)
    .map(([k]) => k);
}

export async function testRevenueCat() {
  const ents = await activeEntitlements('score-connection-test');
  if (ents === null) throw new Error('RevenueCat rejected the secret API key');
  return 'Connected to RevenueCat';
}
