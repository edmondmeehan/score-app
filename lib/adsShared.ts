// Shared between middleware (edge), server and browser code.
export const ATTR_COOKIE = 'score_attr';      // first-touch campaign, 90 days, first-party
export const ADS_OPTOUT_COOKIE = 'score_ads'; // 'off' = no ad pixels and no Conversions API for this browser

/** Pages where ad pixels never load: anything signed-in or private. */
export const NO_PIXEL_PATHS = /^\/(app|admin|onboarding|plans|investors|signin|unsubscribe|w\/)/;

/** Pull campaign fields from a landing URL. Returns null when there's nothing to record. */
export function attrFromParams(params: URLSearchParams, path: string) {
  const s = params.get('utm_source');
  const k = params.get('gclid') ? 'gclid' : params.get('fbclid') ? 'fbclid' : params.get('ttclid') ? 'ttclid' : null;
  if (!s && !k) return null;
  const v = (n: string, max = 120) => (params.get(n) || '').slice(0, max) || undefined;
  return { s: s?.slice(0, 80), m: v('utm_medium', 80), c: v('utm_campaign'), ct: v('utm_content'), t: v('utm_term'), k: k || undefined, p: path.slice(0, 200), at: Date.now() };
}
