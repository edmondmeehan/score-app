import 'server-only';
import type { Band } from '@/lib/types';

// Spinwheel (credit data partner). Sandbox in Preview; production needs its own key.
// We only ever keep the band. The numeric score lives in memory for one request and is never stored or logged.
const BASE = (process.env.SPINWHEEL_API_URL || 'https://sandbox-api.spinwheel.io').replace(/\/$/, '');

export const spinwheelConfigured = () => Boolean(process.env.SPINWHEEL_SECRET_KEY);
export const spinwheelSandbox = () => BASE.includes('sandbox');

type SwResult = { ok: boolean; status: number; body: any };

async function sw(path: string, init?: { method?: string; body?: unknown }): Promise<SwResult> {
  const res = await fetch(BASE + path, {
    method: init?.method || 'GET', cache: 'no-store',
    headers: { Authorization: `Bearer ${process.env.SPINWHEEL_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 200) }; }
  return { ok: res.ok, status: res.status, body };
}

/** A readable message from Spinwheel's error envelope: { status: { desc, messages: [{ desc }] } } */
export function swMessage(r: SwResult): string {
  const s = r.body?.status;
  const parts = [s?.desc, ...(Array.isArray(s?.messages) ? s.messages.map((m: { desc?: string }) => m?.desc) : [])].filter(Boolean);
  return parts.length ? parts.join(': ') : `Credit partner error (${r.status})`;
}

/** First value found under a key name anywhere in the response. */
function findKey(o: any, key: string, depth = 0): any {
  if (!o || typeof o !== 'object' || depth > 8) return undefined;
  if (key in o && o[key] != null && typeof o[key] !== 'object') return o[key];
  for (const v of Object.values(o)) { const f = findKey(v, key, depth + 1); if (f !== undefined) return f; }
  return undefined;
}

/** Credit scores sit under keys like creditScore / score / value with a model name nearby. Take the first 300–900 number under a score-ish key. */
function findScore(o: any, inScore = false, depth = 0): number | null {
  if (o == null || depth > 10) return null;
  if (typeof o === 'number') return inScore && o >= 300 && o <= 900 ? Math.round(o) : null;
  if (typeof o === 'string') { const n = Number(o); return inScore && /^\d{3}$/.test(o) && n >= 300 && n <= 900 ? n : null; }
  if (Array.isArray(o)) { for (const v of o) { const s = findScore(v, inScore, depth + 1); if (s) return s; } return null; }
  if (typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (/factor|reason|range|min|max|date|count|percent|utiliz/i.test(k)) continue;
      const s = findScore(v, inScore || /score/i.test(k) || (inScore && /^(value|score)$/i.test(k)), depth + 1);
      if (s) return s;
    }
  }
  return null;
}

export function scoreToBand(score: number): Band {
  if (score >= 800) return 'elite';
  if (score >= 740) return 'strong';
  if (score >= 670) return 'solid';
  return 'building';
}

export function toE164(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.startsWith('1')) return '+' + d;
  return null;
}

/** Step 1: text the member a one-time code. Our profile id is the Spinwheel extUserId. */
export async function startConnect(profileId: string, phoneE164: string, dob: string) {
  const r = await sw('/v1/users/connect/sms', { method: 'POST', body: { extUserId: profileId, phoneNumber: phoneE164, dateOfBirth: dob } });
  if (!r.ok) {
    // Already connected from an earlier try: carry on with the existing user.
    const existing = await findUser(profileId);
    if (existing && /already connected/i.test(swMessage(r))) return { userId: existing, connected: true };
    throw new Error(swMessage(r));
  }
  const userId = findKey(r.body, 'userId') || (await findUser(profileId));
  if (!userId) throw new Error('The credit partner didn’t return a user. Try again.');
  return { userId: String(userId), connected: false };
}

export async function findUser(profileId: string): Promise<string | null> {
  const r = await sw(`/v1/users?extUserId=${encodeURIComponent(profileId)}`);
  if (!r.ok) return null;
  const id = findKey(r.body, 'userId');
  return id ? String(id) : null;
}

/** Step 2: check the code. */
export async function verifyCode(userId: string, code: string) {
  const r = await sw(`/v1/users/${encodeURIComponent(userId)}/connect/sms/verify`, { method: 'POST', body: { code } });
  if (!r.ok && !/already connected/i.test(swMessage(r))) throw new Error(swMessage(r));
}

/** Step 3: soft pull. Returns the band only. */
export async function pullBand(userId: string): Promise<Band> {
  const id = encodeURIComponent(userId);
  let score: number | null = null;
  const pull = await sw(`/v1/users/${id}/debtProfile`, { method: 'POST', body: { creditScore: { model: process.env.SPINWHEEL_SCORE_MODEL || 'VANTAGE_SCORE_3_0' } } });
  if (pull.ok) score = findScore(pull.body);
  if (!score) {
    // One pull per user per day: fall back to the profile Spinwheel already has.
    const user = await sw(`/v1/users/${id}`);
    if (user.ok || user.status === 206) score = findScore(user.body);
    if (!score && !pull.ok) throw new Error(swMessage(pull));
  }
  if (!score) console.warn('[spinwheel] no score found; response keys:', JSON.stringify(shape(pull.body)));
  if (!score) throw new Error('No credit score came back for this person. They may not have enough credit history yet.');
  return scoreToBand(score);
}

/** Key names only (no values), for diagnosing an unexpected response without logging personal data. */
function shape(o: any, depth = 0): any {
  if (o == null || typeof o !== 'object' || depth > 5) return typeof o;
  if (Array.isArray(o)) return o.length ? [shape(o[0], depth + 1)] : [];
  return Object.fromEntries(Object.entries(o).slice(0, 40).map(([k, v]) => [k, shape(v, depth + 1)]));
}
