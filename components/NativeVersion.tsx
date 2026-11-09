'use client';
import { useEffect, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Inside the iPhone/Android app, show the installed app version and build (e.g. "iPhone app 1.0 (3)"). */
export default function NativeVersion() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const C = (window as any).Capacitor;
    const App = C?.Plugins?.App;
    if (!C?.isNativePlatform?.() || !App?.getInfo) return;
    App.getInfo().then((i: { version: string; build: string }) => setLabel(`${C.getPlatform() === 'android' ? 'Android' : 'iPhone'} app ${i.version} (${i.build})`)).catch(() => null);
  }, []);
  return label ? <span className="mono small" style={{ color: 'var(--faint)', fontSize: 11, letterSpacing: '.06em' }}>{label}</span> : null;
}
