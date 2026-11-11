import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { ATTR_COOKIE, attrFromParams } from '@/lib/adsShared';
import { SESSION_COOKIE, SESSION_MINUTES, VISITOR_COOKIE, isBot, parseUA, sendEvent, trafficSource } from '@/lib/analytics';

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  // Pass the path to server components (used to gate the app while a member is paused).
  const fwd = new Headers(request.headers);
  fwd.set('x-sd-path', request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: fwd } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => { request.cookies.set(name, value); });
          fwd.set('cookie', request.headers.get('cookie') || '');
          response = NextResponse.next({ request: { headers: fwd } });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  // Only ask Supabase who this is when the browser actually has a sign-in cookie. Visitors and bots skip the round trip.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  const { data: { user } } = hasSession ? await supabase.auth.getUser() : { data: { user: null } };
  const path = request.nextUrl.pathname;

  // Brand creative (public/_creative) is staff-only: anyone else gets a plain 404.
  if (path.startsWith('/_creative/')) {
    const staff = user ? (await supabase.rpc('is_staff')).data === true : false;
    if (!staff) return new NextResponse('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
    response.headers.set('Cache-Control', 'private, max-age=3600');
    response.headers.set('X-Robots-Tag', 'noindex');
    return response;
  }

  // Maintenance mode (Admin → Maintenance). Staff, sign-in, legal pages and webhooks keep working.
  if (!MAINT_OPEN.some((p) => path === p || path.startsWith(p + '/')) && (await maintenanceOn(supabase))) {
    const staff = user ? (await supabase.rpc('is_staff')).data === true : false;
    if (!staff) {
      const url = request.nextUrl.clone();
      url.pathname = '/maintenance';
      url.search = '';
      const res = NextResponse.rewrite(url, { status: 503 });
      res.headers.set('Retry-After', '1800');
      res.headers.set('X-Robots-Tag', 'noindex');
      return res;
    }
  }

  const needsAuth = path.startsWith('/app') || path.startsWith('/onboarding') || path.startsWith('/admin') || path.startsWith('/plans');
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  // Two-step sign-in: someone who turned it on must enter their code before using the app.
  if (needsAuth && user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
      const url = request.nextUrl.clone();
      url.pathname = '/two-step';
      url.search = '';
      url.searchParams.set('next', path + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }
  track(request, response, event, user?.id ?? null);
  // Referral links (scoredate.app/?ref=CODE): remember the code for 30 days so the waitlist form can credit it.
  const ref = request.nextUrl.searchParams.get('ref');
  if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) {
    response.cookies.set('score_ref', ref.toUpperCase(), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 30 });
  }
  // Ad campaigns: remember the first campaign that brought this browser here (utm_* or a click ID), 90 days.
  if (request.method === 'GET' && !request.cookies.get(ATTR_COOKIE)) {
    const attr = attrFromParams(request.nextUrl.searchParams, path);
    if (attr) response.cookies.set(ATTR_COOKIE, encodeURIComponent(JSON.stringify(attr)), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 90 });
  }
  // "Last active" powers gentle reminders (we never nudge someone who was just here). At most once an hour.
  if (user && path.startsWith('/app') && request.method === 'GET' && !request.cookies.get('score_seen')) {
    event.waitUntil(Promise.resolve(supabase.rpc('touch_active')).then(() => undefined, () => undefined));
    response.cookies.set('score_seen', '1', { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 });
  }
  // Staging (and any non-production host): keep it out of search results.
  if (request.headers.get('host')?.startsWith('staging.') || process.env.VERCEL_ENV === 'preview') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

const MAINT_OPEN = ['/maintenance', '/admin', '/signin', '/auth', '/legal', '/manifest.webmanifest', '/icon.svg', '/apple-icon.png'];
let maint: { on: boolean; at: number } = { on: false, at: 0 };
/** Checked at most every 20 seconds per server instance, so it adds no real delay. */
async function maintenanceOn(supabase: { from: (t: string) => any }): Promise<boolean> {
  if (Date.now() - maint.at < 20_000) return maint.on;
  try {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'maintenance').maybeSingle();
    maint = { on: Boolean(data?.value?.on), at: Date.now() };
  } catch {
    maint = { on: maint.on, at: Date.now() };
  }
  return maint.on;
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|email/|events/headers/|api/).*)'],
};
