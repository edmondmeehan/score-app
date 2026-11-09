'use client';
import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';
const OPTIONS: [Theme, string][] = [['dark', 'Dark'], ['light', 'Light'], ['system', 'System']];

export function resolvedTheme(): 'dark' | 'light' {
  const t = document.documentElement.dataset.theme as Theme | undefined;
  if (t === 'light') return 'light';
  if (t === 'system') return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return 'dark';
}

/** Dark (default) / Light / System. Saved in a cookie for a year so it sticks on every page and device session. */
export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => { setTheme((document.documentElement.dataset.theme as Theme) || 'dark'); }, []);
  const pick = (t: Theme) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    document.cookie = `score_theme=${t}; path=/; max-age=31536000; samesite=lax`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedTheme() === 'light' ? '#E7E2DB' : '#0B0B0C');
    window.dispatchEvent(new Event('score-theme'));
  };
  return (
    <div className="theme-switch" role="group" aria-label="Appearance">
      {OPTIONS.map(([t, label]) => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => pick(t)}>{label}</button>
      ))}
    </div>
  );
}
