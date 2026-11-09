import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Rotating member pass. The QR holds a short signed token: member id + 30-second window + HMAC.
 * It changes every 30 seconds, so a screenshot stops working within about a minute.
 * Signed with a key derived from SCORE_SERVER_SECRET; nothing secret is ever sent to the phone.
 */
export const PASS_SECONDS = 30;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app').replace(/\/$/, '');

const key = () => createHmac('sha256', process.env.SCORE_SERVER_SECRET || 'dev-only').update('scoredate-member-pass-v1').digest();
const sign = (id: string, w: number) => createHmac('sha256', key()).update(`${id}.${w}`).digest().subarray(0, 12).toString('base64url');
const idToB64 = (uuid: string) => Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url');
const b64ToId = (s: string) => {
  const h = Buffer.from(s, 'base64url').toString('hex');
  return h.length === 32 ? `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` : null;
};

export function passToken(userId: string, at = Date.now()) {
  const w = Math.floor(at / 1000 / PASS_SECONDS);
  const token = `SD1.${idToB64(userId)}.${w.toString(36)}.${sign(userId, w)}`;
  return { token, url: `${SITE}/p/${token}`, expiresIn: PASS_SECONDS - (Math.floor(at / 1000) % PASS_SECONDS) };
}

/** Returns the member id for a valid pass from the current or previous window, otherwise null. */
export function verifyPass(raw: string, at = Date.now()): { userId: string } | { error: 'invalid' | 'expired' } {
  const token = raw.trim().replace(/^https?:\/\/[^/]+\/p\//, '');
  const m = /^SD1\.([A-Za-z0-9_-]{22})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{16})$/.exec(token);
  if (!m) return { error: 'invalid' };
  const id = b64ToId(m[1]);
  const w = parseInt(m[2], 36);
  if (!id || !Number.isFinite(w)) return { error: 'invalid' };
  const want = Buffer.from(sign(id, w)), got = Buffer.from(m[3]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { error: 'invalid' };
  const now = Math.floor(at / 1000 / PASS_SECONDS);
  if (w > now + 1 || w < now - 1) return { error: 'expired' };
  return { userId: id };
}
