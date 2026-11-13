import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Staff only: checks the Turnstile setup without revealing the secret. Sends a dummy token to Cloudflare:
 * "invalid-input-response" back means the secret is accepted; "invalid-input-secret" means it doesn't belong to this account/widget.
 */
export async function GET() {
  const supabase = await supabaseServer();
  const { data: isStaff } = await supabase.rpc('is_staff');
  if (!isStaff) return NextResponse.json({ error: 'staff only' }, { status: 403 });
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hostnames = (process.env.TURNSTILE_HOSTNAMES || 'scoredate.app,www.scoredate.app').split(',').map((h) => h.trim()).filter(Boolean);
  if (!secret) return NextResponse.json({ siteKey, secretSet: false, secretValid: null, hostnames }, { headers: { 'Cache-Control': 'no-store' } });
  let codes: string[] = [];
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: 'dummy-token-for-secret-check' }), cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    codes = ((await res.json()) as { 'error-codes'?: string[] })['error-codes'] || [];
  } catch (e) {
    return NextResponse.json({ siteKey, secretSet: true, secretValid: null, error: (e as Error).message, hostnames }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const secretValid = codes.includes('invalid-input-response') && !codes.includes('invalid-input-secret');
  return NextResponse.json({ siteKey, secretSet: true, secretValid, codes, hostnames }, { headers: { 'Cache-Control': 'no-store' } });
}
