import 'server-only';
import { getIntegration } from '@/lib/integrations';
import { supabaseAnon } from '@/lib/supabase/server';
import { build, type TemplateName } from '@/lib/emails';

// Footer links go to the confirmation page; the header points mail apps at the one-click POST endpoint.
const unsubHeaders = (url?: string) => (url ? { 'List-Unsubscribe': `<${url.replace('/unsubscribe?', '/api/unsubscribe?')}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined);

/**
 * Send a ScoreDate email through Resend. Never throws: a failed email must not break sign-up,
 * billing or verification. Every attempt is written to email_log for the admin.
 */
/** Test accounts (…@seed.scoredate.test and any .test address) never get real email, so nothing bounces. */
const isTestAddress = (to: string) => /\.test$/i.test(to.trim());

export async function sendEmail<K extends TemplateName>(
  to: string | null | undefined,
  name: K,
  data: Parameters<typeof build<K>>[1],
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!to) return { ok: false, error: 'no recipient' };
  if (isTestAddress(to)) return { ok: true, id: 'skipped-test-address' };
  const { subject, html, text } = build(name, data);
  let result: { ok: boolean; id?: string; error?: string };
  try {
    const email = await getIntegration('email');
    const key = email.secrets.resend_api_key || process.env.RESEND_API_KEY;
    const from = email.config.from || process.env.EMAIL_FROM;
    if (!key || !from) {
      result = { ok: false, error: 'Resend not set up (add the API key and From address in admin → Integrations → Email)' };
    } else {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: email.config.from_name ? `${email.config.from_name} <${from}>` : from,
          to: [to],
          subject,
          html,
          text,
          reply_to: email.config.reply_to || undefined,
          tags: [{ name: 'template', value: name }],
        }),
      });
      const body = await res.json().catch(() => ({}));
      result = res.ok ? { ok: true, id: body.id } : { ok: false, error: body?.message || `Resend error ${res.status}` };
    }
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : 'send failed' };
  }
  try {
    await supabaseAnon().rpc('log_email', {
      p_secret: process.env.SCORE_SERVER_SECRET, p_to: to, p_template: name, p_ok: result.ok, p_provider_id: result.id ?? null, p_error: result.error ?? null,
    });
  } catch { /* logging is best effort */ }
  return result;
}

/** Look up a member's email and first name (server only, needs the server secret). */
export async function contactFor(userId: string): Promise<{ email: string | null; first_name: string | null }> {
  const { data } = await supabaseAnon().rpc('get_user_contact', { p_secret: process.env.SCORE_SERVER_SECRET, p_user: userId });
  return { email: data?.email ?? null, first_name: data?.first_name ?? null };
}

export async function testResend(): Promise<string> {
  const email = await getIntegration('email');
  const key = email.secrets.resend_api_key || process.env.RESEND_API_KEY;
  if (!key) throw new Error('Add the Resend API key first');
  const res = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `Resend error ${res.status}`);
  const domains: { name: string; status: string }[] = body.data || [];
  const from = String(email.config.from || '');
  const fromDomain = from.split('@')[1];
  const match = domains.find((d) => d.name === fromDomain);
  if (!match) return `Key works. ${domains.length} domain(s) in Resend, but ${fromDomain || 'your From domain'} isn't one of them yet.`;
  return `Key works. ${match.name} is ${match.status}.`;
}

/**
 * Send one template to many people through Resend's batch endpoint (100 per call).
 * Returns how many were accepted. Each recipient is logged.
 */
export async function sendBatch<K extends TemplateName>(name: K, allItems: { to: string; data: Parameters<typeof build<K>>[1]; unsubUrl?: string }[]) {
  const items = allItems.filter((it) => !isTestAddress(it.to));
  const email = await getIntegration('email');
  const key = email.secrets.resend_api_key || process.env.RESEND_API_KEY;
  const from = email.config.from || process.env.EMAIL_FROM;
  let sent = 0;
  const failures: string[] = [];
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    let ok = false; let err = 'Resend not set up (add the API key and From address in admin → Integrations → Email)';
    let ids: string[] = [];
    if (key && from) {
      try {
        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk.map((it) => {
            const m = build(name, it.data, { unsubUrl: it.unsubUrl });
            return { from: email.config.from_name ? `${email.config.from_name} <${from}>` : from, to: [it.to], subject: m.subject, html: m.html, text: m.text,
              reply_to: email.config.reply_to || undefined, tags: [{ name: 'template', value: name }], headers: unsubHeaders(it.unsubUrl) };
          })),
        });
        const body = await res.json().catch(() => ({}));
        ok = res.ok; err = body?.message || `Resend error ${res.status}`;
        ids = (body?.data || []).map((d: { id: string }) => d.id);
      } catch (e) { err = e instanceof Error ? e.message : 'send failed'; }
    }
    if (ok) sent += chunk.length; else failures.push(err);
    await Promise.all(chunk.map((it, j) => supabaseAnon().rpc('log_email', {
      p_secret: process.env.SCORE_SERVER_SECRET, p_to: it.to, p_template: name, p_ok: ok, p_provider_id: ids[j] ?? null, p_error: ok ? null : err,
    }).then(() => null, () => null)));
  }
  return { sent, failed: items.length - sent, error: failures[0] };
}
