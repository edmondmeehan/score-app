'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

/** True inside the ScoreDate iPhone/Android app. */
export async function isNativeApp() {
  const { Capacitor } = await import('@capacitor/core');
  return Capacitor.isNativePlatform();
}

/** RevenueCat, configured for this member (app user ID = ScoreDate user ID so the webhook finds them). */
export async function purchases(userId: string, iosKey?: string, androidKey?: string) {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return null;
  const key = Capacitor.getPlatform() === 'ios' ? iosKey : androidKey;
  if (!key) return null;
  const mod = await import('@revenuecat/purchases-capacitor');
  const { Purchases } = mod;
  const { isConfigured } = await Purchases.isConfigured();
  if (!isConfigured) await Purchases.configure({ apiKey: key, appUserID: userId });
  else {
    const { appUserID } = await Purchases.getAppUserID();
    if (appUserID !== userId) await Purchases.logIn({ appUserID: userId });
  }
  return mod;
}

/** Did the person just close the App Store sheet? Not an error worth showing. */
export const cancelled = (e: any) => Boolean(e?.userCancelled || e?.code === '1' || e?.code === 1 || /cancel/i.test(String(e?.message || '')));
