'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ADS_OPTOUT_COOKIE, NO_PIXEL_PATHS } from '@/lib/adsShared';

/* eslint-disable @typescript-eslint/no-explicit-any */
type W = Window & { fbq?: any; _fbq?: any; gtag?: any; dataLayer?: any[] };

const META = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GADS = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;            // AW-XXXXXXXXX
const GADS_LEAD = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL; // conversion label for "Waitlist signup"

/** Ads may run for this visitor: not opted out, no Global Privacy Control, not a private page. */
export function adsAllowed(path = typeof location !== 'undefined' ? location.pathname : '/') {
  if (typeof window === 'undefined') return false;
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false;
  if (document.cookie.split('; ').includes(`${ADS_OPTOUT_COOKIE}=off`)) return false;
  return !NO_PIXEL_PATHS.test(path);
}

function loadMeta(w: W) {
  if (!META || w.fbq) return;
  const f: any = function (...args: unknown[]) { f.callMethod ? f.callMethod(...args) : f.queue.push(args); };
  f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
  w.fbq = f; w._fbq = f;
  const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  w.fbq('init', META);
}

function loadGoogle(w: W) {
  if (!GADS || w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () { w.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  w.gtag('js', new Date());
  w.gtag('config', GADS, { allow_ad_personalization_signals: false });
  const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GADS}`;
  document.head.appendChild(s);
}

/** Loads the Meta Pixel and Google tag on public pages only. Renders nothing. Off until the IDs are set. */
export default function AdPixels() {
  const path = usePathname();
  useEffect(() => {
    if (!META && !GADS) return;
    if (!adsAllowed(path)) return;
    const w = window as W;
    loadMeta(w); loadGoogle(w);
    w.fbq?.('track', 'PageView');
  }, [path]);
  return null;
}

/** Waitlist signup conversion. The same eventId goes to Meta's Conversions API so the signup counts once. */
export function trackLead(eventId: string) {
  if (!adsAllowed()) return;
  const w = window as W;
  w.fbq?.('track', 'Lead', {}, { eventID: eventId });
  if (GADS && GADS_LEAD) w.gtag?.('event', 'conversion', { send_to: `${GADS}/${GADS_LEAD}`, transaction_id: eventId });
}

/** Opt this browser out of (or back into) ad measurement. Used on Your Privacy Choices. */
export function setAdsOptOut(off: boolean) {
  document.cookie = `${ADS_OPTOUT_COOKIE}=${off ? 'off' : 'on'}; Path=/; Max-Age=${60 * 60 * 24 * 365 * 2}; SameSite=Lax; Secure`;
}
