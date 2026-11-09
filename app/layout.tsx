import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import AdminBar from '@/components/AdminBar';
import { cookies } from 'next/headers';
import SeasonLayer from '@/components/SeasonLayer';
import AdPixels from '@/components/AdPixels';
import { getSeasonConfig } from '@/lib/seasonsServer';
import { activeSeason, seasonsWith, type SeasonKey } from '@/lib/seasons';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app'),
  openGraph: { type: 'website', siteName: 'ScoreDate', images: [{ url: '/brand/score-share-card-dark.png', width: 1200, height: 630, alt: 'ScoreDate: Date someone who has their act together.' }] },
  twitter: { card: 'summary_large_image', images: ['/brand/score-share-card-dark.png'] },
  title: 'ScoreDate — Date someone who has their act together',
  description: 'Invite-only dating built on honesty about money. Every member verifies their identity.',
  applicationName: 'ScoreDate',
  appleWebApp: { capable: true, title: 'ScoreDate', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};
import IntroSplash, { INTRO_SCRIPT } from '@/components/IntroSplash';

export const viewport: Viewport = { themeColor: '#0B0B0C', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Runs before first paint so there's no flash of the wrong theme.
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )score_theme=(dark|light|system)/);var t=m?m[1]:'dark';var d=document.documentElement;d.dataset.theme=t;var l=t==='light'||(t==='system'&&matchMedia('(prefers-color-scheme: light)').matches);if(l){var e=document.querySelector('meta[name="theme-color"]');if(e)e.setAttribute('content','#E7E2DB');}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Seasonal theme: scheduled automatically, or previewed by staff via a short-lived cookie.
  const cfg = await getSeasonConfig();
  const previewKey = (await cookies()).get('score_season_preview')?.value as SeasonKey | undefined;
  const season = (previewKey && seasonsWith(cfg).find((s) => s.key === previewKey)) || activeSeason(cfg);
  const seasonVars = season ? ({ '--gold': season.accent, '--gold-light': season.accentLight, '--hero-glow': season.glow } as React.CSSProperties) : undefined;
  return (
    <html lang="en" data-theme="dark" data-season={season?.key} style={seasonVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body><IntroSplash /><AdminBar />{children}{season && <SeasonLayer seasonKey={season.key} name={season.name} banner={season.banner} effect={season.effect} preview={Boolean(previewKey)} />}<Analytics /><SpeedInsights /><AdPixels /></body>
    </html>
  );
}
