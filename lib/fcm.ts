import 'server-only';
import { createSign } from 'node:crypto';

/**
 * Native push for the ScoreDate iPhone and Android apps via Firebase Cloud Messaging (HTTP v1).
 * Set FCM_SERVICE_ACCOUNT (the Firebase service-account JSON, as a sensitive env var). iPhone delivery
 * works once the APNs key is uploaded in Firebase → Project settings → Cloud Messaging.
 */
type SA = { client_email: string; private_key: string; project_id: string };
let cached: { token: string; exp: number } | null = null;

function account(): SA | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try { const j = JSON.parse(raw); return j.client_email && j.private_key && j.project_id ? j : null; } catch { return null; }
}
export const fcmReady = () => account() !== null;

const b64 = (o: object | string) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function accessToken(sa: SA): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error('FCM auth failed');
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

/** Returns 'ok', 'dead' (token no longer valid) or 'error'. */
export async function sendNativePush(token: string, n: { title: string; body: string; url: string; tag?: string; high?: boolean }): Promise<'ok' | 'dead' | 'error'> {
  const sa = account();
  if (!sa) return 'error';
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        token, notification: { title: n.title, body: n.body }, data: { url: n.url },
        android: { priority: n.high ? 'HIGH' : 'NORMAL', notification: { tag: n.tag, channel_id: 'score' } },
        apns: { headers: { 'apns-priority': n.high ? '10' : '5' }, payload: { aps: { sound: 'default', 'thread-id': n.tag } } },
      } }),
    });
    if (res.ok) return 'ok';
    const j = await res.json().catch(() => ({}));
    const code = j?.error?.details?.[0]?.errorCode || j?.error?.status;
    return code === 'UNREGISTERED' || code === 'NOT_FOUND' || res.status === 404 ? 'dead' : 'error';
  } catch { return 'error'; }
}
