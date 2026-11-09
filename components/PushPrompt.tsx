'use client';
import { useEffect, useState } from 'react';
import PushToggle from './PushToggle';

const KEY = 'score_push_prompt_dismissed';

/** A soft, dismissible card on the Drop. Never triggers the browser prompt by itself. */
export default function PushPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Inside the iPhone/Android app, iOS asks for notification permission itself (see NativePush), so skip this web card.
    if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) return;
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(KEY); } catch { /* private mode */ }
    if (dismissed || !('Notification' in window || /iPhone|iPad/.test(navigator.userAgent))) return;
    if ('Notification' in window && Notification.permission !== 'default') return;
    setShow(true);
  }, []);
  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setShow(false); };
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row"><strong className="grow">Know when someone writes back</strong><button type="button" className="link small muted" onClick={dismiss} aria-label="Not now" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }}>Not now</button></div>
      <span className="small muted">Messages, date plans and reminders. You choose what you get in Settings, and quiet hours are on by default.</span>
      <PushToggle compact onDone={dismiss} />
    </div>
  );
}
