import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import AdminBar from '@/components/AdminBar';
import { cookies, headers } from 'next/headers';
import SeasonLayer from '@/components/SeasonLayer';
import AdPixels from '@/components/AdPixels';
import { getSeasonConfig } from '@/lib/seasonsServer';
import { activeSeason, seasonsWith, type SeasonKey } from '@/lib/seasons';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app'),
  openGraph: { type: 'website', siteName: 'ScoreDate', images: [{ url: '/brand/score-share-card-dark.png', width: 1200, height: 630, alt: 'ScoreDate: Reliable is the new attractive.' }] },
  twitter: { card: 'summary_large_image', images: ['/brand/score-share-card-dark.png'] },
  title: 'ScoreDate — Reliable is the new attractive',
  description: 'Invite-only dating in New York for people who follow through. Every member is verified. Fewer, better matches that lead to real dates.',
  applicationName: 'ScoreDate',
  appleWebApp: { capable: true, title: 'ScoreDate', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};
import IntroSplash, { INTRO_SCRIPT } from '@/components/IntroSplash';
import LiveBeat from '@/components/LiveBeat';
import NavProgress from '@/components/NavProgress';
import { Suspense } from 'react';
import localFont from 'next/font/local';

// Self-hosted (no request to Google, no layout shift): preloaded with the page.
const serif = localFont({ src: [{ path: './fonts/instrument-serif-latin-400-normal.woff2', weight: '400', style: 'normal' }, { path: './fonts/instrument-serif-latin-400-italic.woff2', weight: '400', style: 'italic' }], variable: '--font-serif', display: 'swap' });
const sans = localFont({ src: [{ path: './fonts/inter-latin-400-normal.woff2', weight: '400' }, { path: './fonts/inter-latin-500-normal.woff2', weight: '500' }, { path: './fonts/inter-latin-600-normal.woff2', weight: '600' }], variable: '--font-sans', display: 'swap' });
const mono = localFont({ src: [{ path: './fonts/jetbrains-mono-latin-400-normal.woff2', weight: '400' }, { path: './fonts/jetbrains-mono-latin-500-normal.woff2', weight: '500' }], variable: '--font-mono', display: 'swap' });

export const viewport: Viewport = { themeColor: '#0B0B0C', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Runs before first paint so there's no flash of the wrong theme.
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )score_theme=(dark|light|system)/);var t=m?m[1]:'dark';var d=document.documentElement;d.dataset.theme=t;var l=t==='light'||(t==='system'&&matchMedia('(prefers-color-scheme: light)').matches);if(l){var e=document.querySelector('meta[name="theme-color"]');if(e)e.setAttribute('content','#E7E2DB');}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Seasonal theme: scheduled automatically, or previewed by staff via a short-lived cookie.
  const cfg = await getSeasonConfig();
  const previewKey = (await cookies()).get('score_season_preview')?.value as SeasonKey | undefined;
  const season = (previewKey && seasonsWith(cfg).find((s) => s.key === previewKey)) || activeSeason(cfg);
  const seasonVars = season ? ({ '--gold': season.accent, '--gold-light': season.accentLight, '--hero-glow': season.glow } as React.CSSProperties) : undefined;
  // Shown.io metrics: homepage and /meet only (the public waitlist pages), never in the iPhone app.
  const h = await headers();
  const path = h.get('x-sd-path') || '';
  const shown = (path === '/' || path === '/meet') && !/ScoreDateApp/.test(h.get('user-agent') || '');
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`} data-theme="dark" data-season={season?.key} style={seasonVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
        {shown && <script defer src="https://shown.io/metrics/V40zqXKR9r" type="text/javascript"></script>}
      </head>
      <body><Suspense fallback={null}><NavProgress /></Suspense><IntroSplash /><AdminBar />{children}{season && <SeasonLayer seasonKey={season.key} name={season.name} banner={season.banner} effect={season.effect} preview={Boolean(previewKey)} />}<Analytics /><SpeedInsights /><AdPixels /><LiveBeat /></body>
    </html>
  );
}
