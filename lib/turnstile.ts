import 'server-only';

/**
 * Cloudflare Turnstile: stops bots on sign-up and the waitlist without making people solve puzzles.
 * Needs NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in Vercel (and TURNSTILE_HOSTNAMES, comma-separated,
 * defaults to scoredate.app + www.scoredate.app). Until the secret is set, every check passes, so nothing breaks.
 * Once it's on, a token passes only if Cloudflare says success, it was made for this form (action) and on our site (hostname).
 */
export type TurnstileAction = 'waitlist' | 'signup';

export const turnstileOn = () => Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

function allowedHosts(): string[] {
  const raw = process.env.TURNSTILE_HOSTNAMES || 'scoredate.app,www.scoredate.app';
  const hosts = raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  // Local testing hosts are only allowed outside production.
  return process.env.VERCEL_ENV === 'production' ? hosts.filter((h) => h !== 'localhost' && h !== '127.0.0.1') : hosts;
}

export async function verifyHuman(form: FormData, ip: string | null | undefined, action: TurnstileAction): Promise<boolean> {
  if (!turnstileOn()) return true;
  const token = form.get('cf-turnstile-response');
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const hosts = allowedHosts();
  if (hosts.length === 0) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; action?: string; hostname?: string; 'error-codes'?: string[] };
    if (data.success !== true) {
      const codes = data['error-codes'] || [];
      // A wrong or missing secret is our setup problem, not a bot: let people through and shout in the logs
      // (check it at /api/staff/turnstile) instead of blocking every sign-up.
      if (codes.includes('invalid-input-secret') || codes.includes('missing-input-secret')) {
        console.error('[turnstile] TURNSTILE_SECRET_KEY is wrong for this widget; check /api/staff/turnstile');
        return true;
      }
      console.warn('[turnstile] rejected:', codes.join(','));
      return false;
    }
    if (data.action !== action) { console.warn('[turnstile] wrong action:', data.action, 'expected', action); return false; }
    if (!data.hostname || !hosts.includes(data.hostname.toLowerCase())) { console.warn('[turnstile] unexpected hostname:', data.hostname); return false; }
    return true;
  } catch (e) {
    console.warn('[turnstile] verify failed:', (e as Error).message);
    return false;
  }
}

export async function clientIp(): Promise<string | null> {
  const { headers } = await import('next/headers');
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || null;
}
