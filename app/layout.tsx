import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import AdminBar from '@/components/AdminBar';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app'),
  openGraph: { type: 'website', siteName: 'Score', images: [{ url: '/brand/score-share-card-dark.png', width: 1200, height: 630, alt: 'Score: Date someone who has their act together.' }] },
  twitter: { card: 'summary_large_image', images: ['/brand/score-share-card-dark.png'] },
  title: 'Score — Date someone who has their act together',
  description: 'Invite-only dating where every member has verified their credit band.',
  applicationName: 'Score',
  appleWebApp: { capable: true, title: 'Score', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: '#0B0B0C', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Runs before first paint so there's no flash of the wrong theme.
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )score_theme=(dark|light|system)/);var t=m?m[1]:'dark';var d=document.documentElement;d.dataset.theme=t;var l=t==='light'||(t==='system'&&matchMedia('(prefers-color-scheme: light)').matches);if(l){var e=document.querySelector('meta[name="theme-color"]');if(e)e.setAttribute('content','#F6F3EC');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body><AdminBar />{children}<Analytics /><SpeedInsights /></body>
    </html>
  );
}
