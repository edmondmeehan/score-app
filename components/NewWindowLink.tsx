'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Opens a page in a new window. In the iPhone/Android app it opens in the in-app Safari sheet
 * (SFSafariViewController via @capacitor/browser), which Apple recommends for policies and web content;
 * the member taps Done to come straight back. On the web it opens a new tab.
 */
export default function NewWindowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const C = (window as any).Capacitor;
    const Browser = C?.Plugins?.Browser;
    if (!C?.isNativePlatform?.() || !Browser?.open) return;
    e.preventDefault();
    const url = href.startsWith('http') ? href : window.location.origin + href;
    Browser.open({ url, presentationStyle: 'popover' }).catch(() => { window.location.href = href; });
  };
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>{children}</a>;
}
