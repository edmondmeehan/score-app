import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { SESSION_COOKIE, VISITOR_COOKIE, isBot } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

/** Heartbeat for Admin → Analytics "Right now". No IP stored: session cookie, path, city from Vercel, app or web. */
export async function POST(request: NextRequest) {
  const ua = request.headers.get('user-agent') || '';
  const sid = request.cookies.get(SESSION_COOKIE)?.value || request.cookies.get(VISITOR_COOKIE)?.value;
  if (!sid || isBot(ua)) return new NextResponse(null, { status: 204 });
  const body = (await request.json().catch(() => ({}))) as { path?: string };
  const city = request.headers.get('x-vercel-ip-city');
  let decoded: string | null = null;
  try { decoded = city ? decodeURIComponent(city) : null; } catch { decoded = city; }
  const supabase = await supabaseServer();
  await supabase.rpc('live_ping', { p_session: sid, p_app: /ScoreDateApp/.test(ua), p_path: String(body.path || '/').slice(0, 200), p_city: decoded });
  return new NextResponse(null, { status: 204 });
}
