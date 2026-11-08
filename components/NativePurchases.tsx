'use client';
import { useEffect } from 'react';

/**
 * Inside the iPhone/Android app (Capacitor), connect RevenueCat as the signed-in ScoreDate member.
 * On the website this does nothing and the RevenueCat code is never downloaded.
 */
export default function NativePurchases({ userId, iosKey, androidKey }: { userId: string; iosKey?: string; androidKey?: string }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const platform = Capacitor.getPlatform();
      const apiKey = platform === 'ios' ? iosKey : platform === 'android' ? androidKey : undefined;
      if (!apiKey || cancelled) return;
      const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
      if (apiKey.startsWith('test_')) await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      const { isConfigured } = await Purchases.isConfigured();
      if (!isConfigured) {
        // appUserID = ScoreDate user id, so the RevenueCat webhook upgrades the right member.
        await Purchases.configure({ apiKey, appUserID: userId });
      } else {
        await Purchases.logIn({ appUserID: userId });
      }
    })().catch((e) => console.warn('[RevenueCat]', e));
    return () => { cancelled = true; };
  }, [userId, iosKey, androidKey]);
  return null;
}
