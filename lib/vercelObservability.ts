import 'server-only';

// Reads Vercel Observability for this project (same data as the Vercel dashboard). Needs VERCEL_API_TOKEN.
const TEAM = process.env.VERCEL_TEAM_ID || 'team_NgoNLTCpkZJtMvofpxa0DBqB';
const PROJECT = process.env.SCORE_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID || 'prj_MKOzvdqJYuJiHTgqBGhUwpgfJGAc';

export const PERIODS = {
  '15m': { label: '15 min', ms: 15 * 60e3, gran: { minutes: 1 } },
  '1h': { label: '1 hour', ms: 60 * 60e3, gran: { minutes: 5 } },
  '24h': { label: '24 hours', ms: 24 * 3600e3, gran: { hours: 1 } },
  '7d': { label: '7 days', ms: 7 * 24 * 3600e3, gran: { hours: 6 } },
} as const;
export type PeriodKey = keyof typeof PERIODS;

type Q = { metric: string; aggregation: string; groupBy?: string[]; filter?: string; limit?: number; series?: boolean };
type Resp = { data?: Record<string, unknown>[]; summary?: Record<string, unknown>[] };

async function query(q: Q, start: Date, end: Date, gran: object): Promise<Resp> {
  const token = process.env.VERCEL_API_TOKEN;
  const res = await fetch(`https://api.vercel.com/v2/observability/query?teamId=${TEAM}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metric: q.metric, aggregation: q.aggregation, groupBy: q.groupBy, filter: q.filter, limit: q.limit ?? 10,
      scope: { type: 'project', ownerId: TEAM, projectIds: [PROJECT] },
      startTime: start.toISOString(), endTime: end.toISOString(), granularity: gran,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Vercel ${res.status}: ${body?.error?.message || res.statusText}`);
  }
  return res.json();
}

const val = (row: Record<string, unknown> | undefined) => {
  if (!row) return 0;
  const k = Object.keys(row).find((x) => x.startsWith('vercel_'));
  const v = k ? Number(row[k]) : 0;
  return Number.isFinite(v) ? v : 0;
};

export type Health = {
  configured: boolean; error?: string; period: PeriodKey;
  total: number; series: { t: string; n: number }[];
  status: { code: string; n: number }[]; classes: Record<'2xx' | '3xx' | '4xx' | '5xx', number>;
  cache: { result: string; n: number }[];
  paths: { path: string; n: number }[];
  errors: { path: string; code: string; n: number }[];
  fnCount: number; fnP75: number; fnP95: number; ttfbP75: number; bytes: number;
};

export async function getHealth(period: PeriodKey): Promise<Health> {
  const empty: Health = { configured: Boolean(process.env.VERCEL_API_TOKEN), period, total: 0, series: [], status: [], classes: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }, cache: [], paths: [], errors: [], fnCount: 0, fnP75: 0, fnP95: 0, ttfbP75: 0, bytes: 0 };
  if (!empty.configured) return empty;
  const p = PERIODS[period];
  const end = new Date(); const start = new Date(end.getTime() - p.ms);
  const run = (q: Q) => query(q, start, end, p.gran);
  try {
    const [req, status, cache, paths, errors, fnCount, fnP75, fnP95, ttfb, bytes] = await Promise.all([
      run({ metric: 'vercel.request.count', aggregation: 'sum', series: true }),
      run({ metric: 'vercel.request.count', aggregation: 'sum', groupBy: ['http_status'], limit: 15 }),
      run({ metric: 'vercel.request.count', aggregation: 'sum', groupBy: ['cache_result'], limit: 8 }),
      run({ metric: 'vercel.request.count', aggregation: 'sum', groupBy: ['request_path'], limit: 10 }),
      run({ metric: 'vercel.request.count', aggregation: 'sum', groupBy: ['request_path', 'http_status'], filter: 'http_status ge 500', limit: 10 }),
      run({ metric: 'vercel.function_invocation.count', aggregation: 'sum' }),
      run({ metric: 'vercel.function_invocation.function_duration_ms', aggregation: 'p75' }),
      run({ metric: 'vercel.function_invocation.function_duration_ms', aggregation: 'p95' }),
      run({ metric: 'vercel.function_invocation.ttfb_ms', aggregation: 'p75' }),
      run({ metric: 'vercel.request.fdt_total_bytes', aggregation: 'sum' }),
    ]);
    const st = (status.summary || []).map((r) => ({ code: String(r.http_status ?? ''), n: val(r) })).filter((r) => r.n > 0);
    const classes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 } as Health['classes'];
    for (const s of st) { const c = `${s.code[0]}xx` as keyof Health['classes']; if (c in classes) classes[c] += s.n; }
    return {
      ...empty,
      total: val(req.summary?.[0]),
      series: (req.data || []).map((r) => ({ t: String(r.timestamp), n: val(r) })),
      status: st,
      classes,
      cache: (cache.summary || []).map((r) => ({ result: String(r.cache_result || 'None'), n: val(r) })).filter((r) => r.n > 0),
      paths: (paths.summary || []).map((r) => ({ path: String(r.request_path), n: val(r) })).filter((r) => r.n > 0),
      errors: (errors.summary || []).map((r) => ({ path: String(r.request_path), code: String(r.http_status), n: val(r) })).filter((r) => r.n > 0),
      fnCount: val(fnCount.summary?.[0]), fnP75: val(fnP75.summary?.[0]), fnP95: val(fnP95.summary?.[0]),
      ttfbP75: val(ttfb.summary?.[0]), bytes: val(bytes.summary?.[0]),
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'Could not load Vercel data' };
  }
}
