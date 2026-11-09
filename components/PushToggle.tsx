'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type State = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'working' | 'native-on' | 'native-off' | 'native-denied';

/* eslint-disable @typescript-eslint/no-explicit-any */
const nativePush = (): any => { const C = typeof window !== 'undefined' ? (window as any).Capacitor : null; return C?.isNativePlatform?.() ? C.Plugins?.PushNotifications : null; };

const b64ToBytes = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const sb = supabaseBrowser;

function detect(): State {
  if (typeof window === 'undefined') return 'loading';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !standalone ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'off';
}

/** Turn push notifications on or off for this device. Only ever asks the browser after a tap. */
export default function PushToggle({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const [state, setState] = useState<State>('loading');
  const [err, setErr] = useState('');

  useEffect(() => {
    const P = nativePush();
    if (P) {
      P.checkPermissions().then((r: { receive: string }) => setState(r.receive === 'granted' ? 'native-on' : r.receive === 'denied' ? 'native-denied' : 'native-off'), () => setState('unsupported'));
      return;
    }
    const s = detect();
    if (s !== 'off') { setState(s); return; }
    navigator.serviceWorker.register('/sw.js').then((reg) => reg.pushManager.getSubscription()).then((sub) => setState(sub ? 'on' : 'off'), () => setState('off'));
  }, []);

  async function enable() {
    setErr(''); setState('working');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error('Push is not configured yet.');
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await sb().rpc('save_push_subscription', {
        p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_platform: /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios-web' : 'web', p_ua: navigator.userAgent.slice(0, 300),
      });
      if (error) throw new Error(error.message);
      setState('on'); onDone?.();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not turn on notifications.'); setState('off'); }
  }

  /** In the app: ask iOS, then register the device with ScoreDate. */
  async function enableNative() {
    const P = nativePush();
    if (!P) return;
    setErr(''); setState('working');
    try {
      const r = await P.requestPermissions();
      if (r.receive !== 'granted') { setState(r.receive === 'denied' ? 'native-denied' : 'native-off'); return; }
      const platform = (window as any).Capacitor.getPlatform?.() === 'android' ? 'android' : 'ios';
      const h = await P.addListener('registration', (t: { value: string }) => {
        sb().rpc('register_native_push', { p_token: t.value, p_platform: platform }).then(() => null, () => null);
        h?.remove?.();
      });
      await P.register();
      setState('native-on'); onDone?.();
    } catch { setErr('Could not turn on notifications.'); setState('native-off'); }
  }

  async function disable() {
    setErr(''); setState('working');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await sb().rpc('delete_push_subscription', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
      setState('off');
    } catch { setState('on'); }
  }

  if (state === 'loading') return null;
  if (state === 'native-on') return <span className="small muted">On for this iPhone. To turn them off, go to iPhone Settings → ScoreDate → Notifications. Choose which kinds you get below.</span>;
  if (state === 'native-denied') return <span className="small muted">Notifications are off for ScoreDate. Turn them on in iPhone Settings → ScoreDate → Notifications.</span>;
  if (state === 'native-off') return <button type="button" className={compact ? 'btn sm' : 'btn ghost sm'} onClick={enableNative}>Turn on notifications</button>;
  if (state === 'unsupported') return compact ? null : <span className="small muted">This browser doesn&apos;t support notifications.</span>;
  if (state === 'ios-install') return <span className="small muted">On iPhone, tap Share → <strong>Add to Home Screen</strong>, open ScoreDate from your home screen, then turn on notifications here.</span>;
  if (state === 'denied') return <span className="small muted">Notifications are blocked for ScoreDate. Turn them on in your browser or phone settings, then come back.</span>;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {state === 'on'
        ? <div className="row"><span className="grow small">On for this device</span><button type="button" className="btn ghost sm" onClick={disable}>Turn off</button></div>
        : <button type="button" className={compact ? 'btn sm' : 'btn ghost sm'} onClick={enable} disabled={state === 'working'}>{state === 'working' ? 'One sec…' : 'Turn on notifications'}</button>}
      {err && <span className="small" style={{ color: 'var(--red, #e5484d)' }}>{err}</span>}
    </div>
  );
}
