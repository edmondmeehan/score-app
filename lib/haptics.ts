'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning';
const PATTERN: Record<HapticKind, number | number[]> = { selection: 6, light: 10, medium: 18, heavy: 30, success: [12, 70, 24], warning: [24, 90, 24] };
const KEY = 'score_haptics';

export function hapticsOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setHaptics(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}

let iosSwitch: HTMLLabelElement | null = null;
/** iPhone Safari (iOS 18+) has no vibration API, but toggling a native switch control plays a light system haptic. */
function iosTick() {
  if (typeof document === 'undefined') return;
  if (!iosSwitch) {
    iosSwitch = document.createElement('label');
    iosSwitch.setAttribute('aria-hidden', 'true');
    iosSwitch.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    iosSwitch.appendChild(input);
    document.body.appendChild(iosSwitch);
  }
  iosSwitch.click();
}

/** Light physical feedback on supported phones. No-op on desktop or when turned off in Settings. */
export function haptic(kind: HapticKind = 'light') {
  if (typeof window === 'undefined' || !hapticsOn()) return;
  const w = window as any;
  // Native app wrappers (Capacitor / WKWebView) get real Taptic Engine haptics.
  if (w.Capacitor?.Plugins?.Haptics) {
    const H = w.Capacitor.Plugins.Haptics;
    if (kind === 'success' || kind === 'warning') H.notification({ type: kind.toUpperCase() }).catch(() => null);
    else if (kind === 'selection') H.selectionChanged?.().catch?.(() => null);
    else H.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }).catch(() => null);
    return;
  }
  if (w.webkit?.messageHandlers?.haptic) { w.webkit.messageHandlers.haptic.postMessage(kind); return; }
  if (typeof navigator.vibrate === 'function') { navigator.vibrate(PATTERN[kind]); return; }
  if (/iP(hone|ad|od)/.test(navigator.userAgent)) iosTick();
}
