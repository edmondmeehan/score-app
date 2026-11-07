import 'server-only';

// Talks to the Vercel REST API for this project's firewall. Needs VERCEL_API_TOKEN (sensitive env var).
const API = 'https://api.vercel.com';
const TEAM = process.env.VERCEL_TEAM_ID || 'team_NgoNLTCpkZJtMvofpxa0DBqB';
const PROJECT = process.env.SCORE_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID || 'prj_MKOzvdqJYuJiHTgqBGhUwpgfJGAc';
export const BYPASS_RULE_NAME = 'Score: let webhooks and cron through';

// Server-to-server endpoints that must never get a browser challenge (RevenueCat, ID verification, cron, email unsubscribe).
const SERVER_PATHS = ['/api/billing/', '/api/verify/webhook', '/api/cron', '/api/unsubscribe'];

export type SecurityStatus = {
  configured: boolean;
  attackMode: { on: boolean; until: number | null };
  botProtection: { on: boolean; action: string | null };
  aiBots: { on: boolean; action: string | null };
  bypassRule: boolean;
  error?: string;
};

async function call(path: string, init?: RequestInit) {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) throw new Error('Add VERCEL_API_TOKEN in Vercel → Settings → Environment Variables first.');
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}${path}${sep}teamId=${TEAM}`, {
    ...init, cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Vercel API error ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body;
}

export async function getSecurityStatus(): Promise<SecurityStatus> {
  const empty: SecurityStatus = { configured: Boolean(process.env.VERCEL_API_TOKEN), attackMode: { on: false, until: null }, botProtection: { on: false, action: null }, aiBots: { on: false, action: null }, bypassRule: false };
  if (!process.env.VERCEL_API_TOKEN) return empty;
  try {
    const project = await call(`/v9/projects/${PROJECT}`);
    const sec = project?.security || {};
    const until = typeof sec.attackModeActiveUntil === 'number' ? sec.attackModeActiveUntil : null;
    const attackOn = Boolean(sec.attackModeEnabled) && (until === null || until > Date.now());
    let fw: { managedRules?: Record<string, { active?: boolean; action?: string }>; rules?: { name?: string; active?: boolean }[] } | null = null;
    try { fw = await call(`/v1/security/firewall/config/active?projectId=${PROJECT}`); }
    catch (e) { if ((e as { status?: number }).status !== 404) throw e; }
    const mr = fw?.managedRules || {};
    return {
      configured: true,
      attackMode: { on: attackOn, until: attackOn ? until : null },
      botProtection: { on: Boolean(mr.bot_protection?.active), action: mr.bot_protection?.action || null },
      aiBots: { on: Boolean(mr.ai_bots?.active), action: mr.ai_bots?.action || null },
      bypassRule: Boolean(fw?.rules?.some((r) => r.name === BYPASS_RULE_NAME && r.active)),
    };
  } catch (e) {
    return { ...empty, error: (e as Error).message };
  }
}

/** Browser check (Vercel Attack Challenge Mode) for every visitor. hours = 0 turns it off. */
export async function setAttackMode(hours: number) {
  const on = hours > 0;
  await call('/v1/security/attack-mode', {
    method: 'POST',
    body: JSON.stringify({ projectId: PROJECT, attackModeEnabled: on, ...(on ? { attackModeActiveUntil: Date.now() + hours * 3600_000 } : {}) }),
  });
}

async function patchFirewall(body: unknown) {
  await call(`/v1/security/firewall/config?projectId=${PROJECT}`, { method: 'PATCH', body: JSON.stringify(body) });
}

/** Make sure webhooks and cron skip bot challenges (they can't solve them). */
export async function ensureBypassRule() {
  const status = await getSecurityStatus();
  if (status.bypassRule) return;
  await patchFirewall({
    action: 'rules.insert', id: null,
    value: {
      name: BYPASS_RULE_NAME, active: true,
      description: 'Server-to-server endpoints (RevenueCat, ID verification, cron, unsubscribe) cannot solve browser challenges.',
      conditionGroup: SERVER_PATHS.map((p) => ({ conditions: [{ type: 'path', op: 'pre', value: p }] })),
      action: { mitigate: { action: 'bypass' } },
    },
  });
}

/** Bot protection ("bot fight mode"): challenges automated traffic that isn't a known good bot. */
export async function setBotProtection(on: boolean) {
  if (on) await ensureBypassRule();
  await patchFirewall({ action: 'managedRules.update', id: 'bot_protection', value: { active: on, action: 'challenge' } });
}

/** Block AI crawlers and scrapers. */
export async function setAiBots(on: boolean) {
  await patchFirewall({ action: 'managedRules.update', id: 'ai_bots', value: { active: on, action: 'deny' } });
}
