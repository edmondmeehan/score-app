import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Partner links: record the click (Admin → Credit partners), then send the member to the partner's affiliate link. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const from = new URL(req.url).searchParams.get('from') || '';
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return NextResponse.redirect(new URL('/', req.url));
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('partner_click', { p_slug: slug, p_placement: from.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) });
  const url = typeof data === 'string' && data.startsWith('https://') ? data : null;
  if (!url) return NextResponse.redirect(new URL('/onboarding/credit', req.url));
  const res = NextResponse.redirect(url, 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}
