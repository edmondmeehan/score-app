import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_MINUTES, VISITOR_COOKIE, isBot, parseUA, sendEvent, trafficSource } from '@/lib/analytics';

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const needsAuth = path.startsWith('/app') || path.startsWith('/onboarding') || path.startsWith('/admin') || path.startsWith('/plans');
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  track(request, response, event, user?.id ?? null);
  // "Last active" powers gentle reminders (we never nudge someone who was just here). At most once an hour.
  if (user && path.startsWith('/app') && request.method === 'GET' && !request.cookies.get('score_seen')) {
    event.waitUntil(Promise.resolve(supabase.rpc('touch_active')).then(() => undefined, () => undefined));
    response.cookies.set('score_seen', '1', { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 });
  }
  return response;
}

/** Record a page view (skips bots, prefetches, server-action posts, files and the admin area). */
function track(request: NextRequest, response: NextResponse, event: NextFetchEvent, userId: string | null) {
  const path = request.nextUrl.pathname;
  const h = request.headers;
  const ua = h.get('user-agent') || '';
  const prefetch = h.get('next-router-prefetch') || h.get('purpose') === 'prefetch' || h.get('sec-purpose')?.includes('prefetch');
  if (request.method !== 'GET' || prefetch || isBot(ua) || path.startsWith('/admin') || /\.[a-z0-9]+$/i.test(path)) return;

  let visitor = request.cookies.get(VISITOR_COOKIE)?.value;
  let session = request.cookies.get(SESSION_COOKIE)?.value;
  const newSession = !session;
  if (!visitor) visitor = crypto.randomUUID();
  if (!session) session = crypto.randomUUID();
  const opts = { httpOnly: true, sameSite: 'lax' as const, secure: true, path: '/' };
  response.cookies.set(VISITOR_COOKIE, visitor, { ...opts, maxAge: 60 * 60 * 24 * 365 });
  response.cookies.set(SESSION_COOKIE, session, { ...opts, maxAge: SESSION_MINUTES * 60 });

  // Client-side navigations arrive as RSC requests whose referrer is our own page: only the first hit carries the source.
  const src = newSession ? trafficSource(h.get('referer'), request.nextUrl.hostname, request.nextUrl.searchParams) : null;
  const { os, device, browser } = parseUA(ua);
  const decode = (v: string | null) => { try { return v ? decodeURIComponent(v) : null; } catch { return v; } };
  event.waitUntil(sendEvent({
    name: 'pageview', visitor_id: visitor, session_id: session, new_session: newSession, user_id: userId, path,
    source: src?.source ?? null, medium: src?.medium ?? null, campaign: src?.campaign ?? null, referrer_host: src?.referrerHost ?? null,
    os, device, browser,
    country: h.get('x-vercel-ip-country'), region: h.get('x-vercel-ip-country-region'), city: decode(h.get('x-vercel-ip-city')),
  }));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|email/|api/).*)'],
};
