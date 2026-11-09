// First-party analytics helpers. Works in middleware (edge) and server actions.
// No IP addresses are stored: just a random visitor cookie, coarse location from Vercel, and the device type.

export const VISITOR_COOKIE = 'score_vid';
export const SESSION_COOKIE = 'score_sid';
export const SESSION_MINUTES = 30;

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora|pinterest|vercel|headless|lighthouse|monitor|curl|wget|python|axios|node-fetch/i;
export const isBot = (ua: string) => !ua || BOT.test(ua);

export function parseUA(ua: string) {
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'ChromeOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Other';
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'Tablet' : /Mobi|iPhone|Android/.test(ua) ? 'Mobile' : 'Desktop';
  const browser = /ScoreDateApp/.test(ua) ? 'ScoreDate iPhone app' : /Instagram/.test(ua) ? 'Instagram app' : /FBAN|FBAV|FB_IAB/.test(ua) ? 'Facebook app' : /TikTok|BytedanceWebview/.test(ua) ? 'TikTok app'
    : /LinkedInApp/.test(ua) ? 'LinkedIn app' : /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  return { os, device, browser };
}

const SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/duckduckgo\.com$/, 'DuckDuckGo'], [/(^|\.)yahoo\./, 'Yahoo'],
  [/instagram\.com$/, 'Instagram'], [/(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'], [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X'],
  [/tiktok\.com$/, 'TikTok'], [/(linkedin\.com|lnkd\.in)$/, 'LinkedIn'], [/reddit\.com$/, 'Reddit'], [/threads\.net$/, 'Threads'],
  [/(chatgpt\.com|openai\.com)$/, 'ChatGPT'], [/youtube\.com$/, 'YouTube'], [/(mail\.google\.com|outlook\.|mail\.yahoo)/, 'Email'],
];

export function trafficSource(referrer: string | null, ownHost: string, params: URLSearchParams) {
  const utm = params.get('utm_source');
  let referrerHost: string | null = null;
  try { referrerHost = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : null; } catch { referrerHost = null; }
  if (referrerHost && (referrerHost === ownHost.replace(/^www\./, '') || referrerHost.endsWith('.vercel.app') && ownHost.endsWith('.vercel.app'))) referrerHost = null;
  let source: string = 'Direct';
  if (utm) source = utm.slice(0, 80);
  else if (params.get('code') || params.get('ref')) source = 'Invite link';
  else if (referrerHost) source = SOURCES.find(([re]) => re.test(referrerHost!))?.[1] || referrerHost;
  return { source, medium: params.get('utm_medium'), campaign: params.get('utm_campaign'), referrerHost };
}

export type TrackPayload = Record<string, string | boolean | null | undefined>;

/** Insert one event through the server-secret RPC. Plain fetch so it also works on the edge. */
export async function sendEvent(p: TrackPayload) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SCORE_SERVER_SECRET;
  if (!url || !key || !secret) return;
  try {
    await fetch(`${url}/rest/v1/rpc/track_event`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, p }),
    });
  } catch { /* analytics never breaks a request */ }
}
