import 'server-only';

/**
 * Cloudflare Turnstile: stops bots on sign-up and the waitlist without making people solve puzzles.
 * Set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in Vercel to turn it on. Until both are set,
 * every check passes, so nothing breaks.
 */
export const turnstileOn = () => Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

export async function verifyHuman(form: FormData, ip?: string | null): Promise<boolean> {
  if (!turnstileOn()) return true;
  const token = String(form.get('cf-turnstile-response') || '');
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, cache: 'no-store' });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return true; // Cloudflare unreachable: don't lock real people out
  }
}

export async function clientIp(): Promise<string | null> {
  const { headers } = await import('next/headers');
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || null;
}
