/** Server errors are recorded so staff get an email alert (see /api/cron) instead of finding out from members. */
export async function register() {}

type Req = { path: string; method: string };
type Ctx = { routeType?: string };

export async function onRequestError(err: unknown, request: Req, context: Ctx) {
  try {
    const e = err as { message?: string; digest?: string };
    if (String(e?.digest || '').startsWith('NEXT_')) return; // redirects / not-found are normal
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secret = process.env.SCORE_SERVER_SECRET;
    if (!url || !key || !secret) return;
    await fetch(`${url}/rest/v1/rpc/log_app_error`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, p_path: `${request.method} ${request.path}`.slice(0, 300), p_message: String(e?.message || err).slice(0, 1000), p_digest: String(e?.digest || ''), p_kind: context?.routeType || 'server' }),
    });
  } catch { /* never let error reporting break a request */ }
}
