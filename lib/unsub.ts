import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { SITE_URL } from '@/lib/emails';

export type UnsubKind = 'all' | 'daily_drop' | 'messages' | 'events' | 'reminders';
export const UNSUB_KINDS: UnsubKind[] = ['all', 'daily_drop', 'messages', 'events', 'reminders'];

const sig = (userId: string, kind: string) =>
  createHmac('sha256', process.env.SCORE_SERVER_SECRET || 'missing').update(`unsub:${userId}:${kind}`).digest('base64url').slice(0, 32);

/** A signed one-click unsubscribe link for one kind of email. */
export function unsubUrl(userId: string, kind: UnsubKind) {
  return `${SITE_URL}/unsubscribe?u=${userId}&k=${kind}&s=${sig(userId, kind)}`;
}

export function verifyUnsub(userId: string, kind: string, s: string) {
  if (!/^[0-9a-f-]{36}$/.test(userId) || !(UNSUB_KINDS as string[]).includes(kind)) return false;
  const a = Buffer.from(sig(userId, kind));
  const b = Buffer.from(s || '');
  return a.length === b.length && timingSafeEqual(a, b);
}
