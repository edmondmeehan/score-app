'use client';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Inside the Score iPhone/Android app (Capacitor): ask for push permission once and register the device. */
export default function NativePush() {
  useEffect(() => {
    const C = (window as any).Capacitor;
    const P = C?.Plugins?.PushNotifications;
    if (!C?.isNativePlatform?.() || !P) return;
    const platform = C.getPlatform?.() === 'android' ? 'android' : 'ios';
    let subs: any[] = [];
    (async () => {
      try {
        let perm = await P.checkPermissions();
        if (perm.receive === 'prompt') perm = await P.requestPermissions();
        if (perm.receive !== 'granted') return;
        subs.push(await P.addListener('registration', (t: { value: string }) => {
          supabaseBrowser().rpc('register_native_push', { p_token: t.value, p_platform: platform }).then(() => null, () => null);
        }));
        subs.push(await P.addListener('pushNotificationActionPerformed', (a: any) => {
          const url = a?.notification?.data?.url;
          if (typeof url === 'string' && url.startsWith('/')) window.location.href = url;
        }));
        await P.register();
      } catch { /* push not available */ }
    })();
    return () => { subs.forEach((s) => s?.remove?.()); subs = []; };
  }, []);
  return null;
}
