import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'Score — Date someone who has their act together',
  description: 'Invite-only dating where every member has verified their credit band.',
  applicationName: 'Score',
  appleWebApp: { capable: true, title: 'Score', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: '#0B0B0C', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}<Analytics /></body>
    </html>
  );
}
