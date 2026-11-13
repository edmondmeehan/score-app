'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;
function load(): Promise<void> {
  if ((window as any).turnstile) return Promise.resolve();
  if (!loading) loading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = SRC; s.async = true; s.onload = () => res(); s.onerror = rej; document.head.appendChild(s); });
  return loading;
}

/**
 * Invisible bot check for forms (Cloudflare Turnstile). It adds a hidden "cf-turnstile-response" field to the form and
 * shows a small challenge only when Cloudflare is unsure. Tokens are single-use: the waitlist form re-mounts this after each
 * submit (new key), and sign-up reloads the page, so every attempt gets a fresh token. Does nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
export default function Turnstile({ action }: { action: 'waitlist' | 'signup' }) {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!key || !el.current) return;
    let id: string | undefined; let gone = false;
    load().then(() => {
      if (gone || !el.current) return;
      id = (window as any).turnstile.render(el.current, { sitekey: key, action, appearance: 'interaction-only', theme: 'auto', size: 'flexible' });
    }).catch(() => undefined);
    return () => { gone = true; try { if (id) (window as any).turnstile?.remove(id); } catch { /* ignore */ } };
  }, [key, action]);
  if (!key) return null;
  return <div ref={el} style={{ gridColumn: '1 / -1' }} />;
}
