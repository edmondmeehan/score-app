import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { sendEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Supabase "Send Email" auth hook: every sign-in, confirm, reset, invite and email-change email is sent by us through
 * Resend with ScoreDate's own templates, instead of Supabase's built-in mailer.
 * Turn on in Supabase → Authentication → Hooks → Send Email → HTTPS: https://www.scoredate.app/api/auth/email-hook
 * and save the generated secret (v1,whsec_…) in Vercel as SEND_EMAIL_HOOK_SECRET.
 */

type Payload = {
  user: { id: string; email: string; new_email?: string | null; user_metadata?: Record<string, unknown> };
  email_data: { token: string; token_hash: string; redirect_to: string; email_action_type: string; site_url: string; token_new: string; token_hash_new: string; old_email?: string };
};

/** Standard Webhooks signature check (what Supabase uses): HMAC-SHA256 over "id.timestamp.body" with the base64 secret. */
function verify(body: string, h: Headers, secret: string): boolean {
  const id = h.get('webhook-id'), ts = h.get('webhook-timestamp'), sigs = h.get('webhook-signature');
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false;   // reject replays older than 5 minutes
  const key = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(' ').some((part) => {
    const [ver, sig] = part.split(',');
    if (ver !== 'v1' || !sig) return false;
    const got = Buffer.from(sig, 'base64');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

const fail = (status: number, message: string) => NextResponse.json({ error: { http_code: status, message } }, { status });

export async function POST(req: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) return fail(500, 'SEND_EMAIL_HOOK_SECRET is not set');
  const body = await req.text();
  if (!verify(body, req.headers, secret)) return fail(401, 'bad signature');

  let p: Payload;
  try { p = JSON.parse(body) as Payload; } catch { return fail(400, 'bad json'); }
  const { user, email_data: e } = p;
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const link = (hash: string) => `${supabaseUrl}/auth/v1/verify?${new URLSearchParams({ token: hash, type: e.email_action_type, redirect_to: e.redirect_to || e.site_url })}`;

  const results: { ok: boolean; error?: string }[] = [];
  switch (e.email_action_type) {
    case 'signup':
      results.push(await sendEmail(user.email, 'auth_confirm', { url: link(e.token_hash) }));
      break;
    case 'invite':
      results.push(await sendEmail(user.email, 'auth_invite', { url: link(e.token_hash) }));
      break;
    case 'magiclink':
    case 'email':
      results.push(await sendEmail(user.email, 'magic_link', { url: link(e.token_hash) }));
      break;
    case 'recovery':
      results.push(await sendEmail(user.email, 'auth_reset', { url: link(e.token_hash) }));
      break;
    case 'reauthentication':
      results.push(await sendEmail(user.email, 'auth_reauth', { code: e.token }));
      break;
    case 'email_change': {
      // Supabase's field names are reversed for backward compatibility: token_hash_new goes to the CURRENT address,
      // token_hash to the NEW one. With secure email change on, both addresses get a link.
      const next = user.new_email || '';
      if (e.token_hash_new) results.push(await sendEmail(user.email, 'auth_email_change', { url: link(e.token_hash_new), new_email: next }));
      if (e.token_hash && next) results.push(await sendEmail(next, 'auth_email_change', { url: link(e.token_hash), new_email: next }));
      break;
    }
    default: {
      // Security notices (password changed, email changed, MFA added or removed, …): a short heads-up.
      const what: Record<string, string> = {
        password_changed_notification: 'Your ScoreDate password was changed.',
        email_changed_notification: 'The email on your ScoreDate account was changed.',
        phone_changed_notification: 'The phone number on your ScoreDate account was changed.',
        identity_linked_notification: 'A new sign-in method was added to your ScoreDate account.',
        identity_unlinked_notification: 'A sign-in method was removed from your ScoreDate account.',
        mfa_factor_enrolled_notification: 'Two-step sign-in was turned on for your ScoreDate account.',
        mfa_factor_unenrolled_notification: 'Two-step sign-in was removed from your ScoreDate account.',
      };
      const to = e.email_action_type === 'email_changed_notification' && e.old_email ? e.old_email : user.email;
      results.push(await sendEmail(to, 'notification', {
        first_name: null, title: what[e.email_action_type] || 'A change was made to your ScoreDate account.',
        body: 'If this was you, there’s nothing to do. If it wasn’t, reset your password and contact support@scoredate.app right away.',
        url: `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app').replace(/\/$/, '')}/app/settings`, category: 'reminder',
      }));
    }
  }

  const bad = results.find((r) => !r.ok);
  if (bad) return fail(500, `Email not sent: ${bad.error || 'unknown error'}`);
  return NextResponse.json({});
}
