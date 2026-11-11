/**
 * In-app purchase catalog. These IDs must match App Store Connect exactly (and the RevenueCat products).
 * Subscriptions unlock a RevenueCat entitlement with the same name as the ScoreDate plan
 * (membership, premium, black); Preview and add-ons are one-time purchases.
 */
export const BUNDLE = 'co.please.scoredate';

export const SUBSCRIPTIONS = [
  { id: `${BUNDLE}.membership.monthly`, plan: 'membership', period: 'month', price: '$24.99' },
  { id: `${BUNDLE}.membership.annual`, plan: 'membership', period: 'year', price: '$155.99' },
  { id: `${BUNDLE}.premium.monthly`, plan: 'premium', period: 'month', price: '$49.99' },
  { id: `${BUNDLE}.premium.annual`, plan: 'premium', period: 'year', price: '$349.99' },
  { id: `${BUNDLE}.reserve.monthly`, plan: 'black', period: 'month', price: '$149.00' },
] as const;

/** One-time: Preview (30 days, non-renewing) and consumable add-ons (sku = addon_catalog sku). */
export const PREVIEW_PRODUCT = `${BUNDLE}.preview.30day`;
/** Founding Lifetime: one-time (non-consumable) purchase that unlocks Premium for as long as ScoreDate runs. */
export const LIFETIME_PRODUCT = `${BUNDLE}.lifetime.premium`;
/** Founding Lifetime, regular price (sold once the early-price spots are gone). Same unlock as LIFETIME_PRODUCT. */
export const LIFETIME_PRODUCT_2 = `${BUNDLE}.lifetime.premium.tier2`;
export const LIFETIME_PRODUCTS = [LIFETIME_PRODUCT, LIFETIME_PRODUCT_2];

/** Every Preview product ID we accept (the first ID was taken on Apple's side, so the old one stays as a fallback). */
export const PREVIEW_PRODUCTS = [PREVIEW_PRODUCT, `${BUNDLE}.preview.once`];
export const ADDON_PRODUCTS: Record<string, string> = {
  extra_drop_1: `${BUNDLE}.addon.extra_drop_1`,
  spotlight_1: `${BUNDLE}.addon.spotlight_1`,
  note_1: `${BUNDLE}.addon.note_1`,
  note_5: `${BUNDLE}.addon.note_5`,
};
export const skuForProduct = (productId: string | null | undefined) =>
  Object.entries(ADDON_PRODUCTS).find(([, p]) => p === productId)?.[0] ?? null;

export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/** ScoreDate plan for a subscription product ID (used when RevenueCat entitlements aren't attached). */
export const planForProduct = (productId: string | null | undefined) => SUBSCRIPTIONS.find((x) => x.id === productId)?.plan ?? null;
