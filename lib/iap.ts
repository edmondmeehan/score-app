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
export const PREVIEW_PRODUCT = `${BUNDLE}.preview.once`;
export const ADDON_PRODUCTS: Record<string, string> = {
  extra_drop_1: `${BUNDLE}.addon.extra_drop_1`,
  spotlight_1: `${BUNDLE}.addon.spotlight_1`,
  note_1: `${BUNDLE}.addon.note_1`,
  note_5: `${BUNDLE}.addon.note_5`,
};
export const skuForProduct = (productId: string | null | undefined) =>
  Object.entries(ADDON_PRODUCTS).find(([, p]) => p === productId)?.[0] ?? null;

export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
