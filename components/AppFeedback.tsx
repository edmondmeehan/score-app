'use client';
import { useEffect, useState } from 'react';
import { haptic, type HapticKind } from '@/lib/haptics';
import { supabaseBrowser } from '@/lib/supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * App-wide feedback:
 * - Haptics on buttons, tabs and choices (data-haptic="medium" etc. to change the strength).
 * - Screenshot tracking. Browsers can't block screenshots, so we record the ones we can detect
 *   (PrintScreen on computers, and screenshot events from the iPhone/Android app wrappers) for staff review.
 */
export default function AppFeedback() {
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('[data-haptic], .btn, .tabbar a, .choice') as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled) return;
      haptic((el.dataset.haptic as HapticKind) || (el.matches('.choice') ? 'selection' : 'light'));
    };
    document.addEventListener('click', onClick, { capture: true, passive: true });

    let last = 0;
    const report = (source: 'web' | 'ios' | 'android') => {
      const now = Date.now();
      if (now - last < 4000) return;
      last = now;
      const ctx = (window as any).__scoreShot || { context: location.pathname.split('/')[2] || 'app', target: null };
      supabaseBrowser().rpc('log_screenshot', { p_context: ctx.context, p_target: ctx.target, p_source: source }).then(() => null, () => null);
      setNotice(true);
      haptic('warning');
      setTimeout(() => setNotice(false), 5000);
    };
    (window as any).scoreScreenshot = (source: 'ios' | 'android' = 'ios') => report(source);
    // Inside the Score iPhone/Android app: block screenshots on Android and hide content in the app switcher
    // (needs the @capacitor-community/privacy-screen plugin in the native build; harmless if it isn't there).
    (window as any).Capacitor?.Plugins?.PrivacyScreen?.enable?.().catch?.(() => null);
    const onNative = (e: Event) => report(((e as CustomEvent).detail === 'android' ? 'android' : 'ios'));
    window.addEventListener('scoreScreenshot', onNative);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key))) report('web');
    };
    window.addEventListener('keyup', onKey);
    window.addEventListener('keydown', onKey);
    // Stop "Save image" from the long-press / right-click menu on member photos.
    const onMenu = (e: MouseEvent) => { if ((e.target as HTMLElement)?.closest?.('.photo')) e.preventDefault(); };
    document.addEventListener('contextmenu', onMenu);
    return () => {
      document.removeEventListener('click', onClick, { capture: true } as any);
      window.removeEventListener('scoreScreenshot', onNative);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('contextmenu', onMenu);
    };
  }, []);

  return notice ? (
    <div role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 80, maxWidth: 440, margin: '0 auto' }} className="notice">
      Screenshots are recorded to protect members’ privacy. Please don’t share other people’s profiles or messages.
    </div>
  ) : null;
}
