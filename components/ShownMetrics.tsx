import Script from 'next/script';
import { headers } from 'next/headers';

/** Shown.io site metrics. Public waitlist landing pages only, never inside the iPhone app or signed-in pages. */
export default async function ShownMetrics() {
  const ua = (await headers()).get('user-agent') || '';
  if (/ScoreDateApp/.test(ua)) return null;
  return <Script src="https://shown.io/metrics/V40zqXKR9r" strategy="afterInteractive" />;
}
