import 'server-only';
import crypto from 'node:crypto';
import { getIntegration } from '@/lib/integrations';

const BASE = 'https://api.withpersona.com/api/v1';

export async function personaConfigured() {
  // Off switch: set PERSONA_DISABLED=1 in Vercel to pause Persona (ID step falls back to test mode) without deleting keys.
  if (process.env.PERSONA_DISABLED === '1') return false;
  const i = await getIntegration('persona');
  return Boolean(i.enabled && i.secrets.api_key && i.config.template_id);
}

async function call(path: string, init?: RequestInit) {
  const i = await getIntegration('persona');
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${i.secrets.api_key}`,
      'Content-Type': 'application/json',
      'Persona-Version': '2023-01-05',
      'Key-Inflection': 'kebab',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Persona ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Create an inquiry (ID + selfie with liveness, configured in the Persona template) and return a one-time link. */
export async function startInquiry(userId: string) {
  const i = await getIntegration('persona');
  const created = await call('/inquiries', {
    method: 'POST',
    body: JSON.stringify({ data: { attributes: { 'inquiry-template-id': i.config.template_id, 'reference-id': userId } } }),
  });
  const id: string = created.data.id;
  const link = await call(`/inquiries/${id}/generate-one-time-link`, { method: 'POST' });
  return { id, url: link.meta['one-time-link'] as string };
}

export type IdResult = 'approved' | 'declined' | 'review' | 'pending';

export function mapStatus(s: string): IdResult {
  if (s === 'approved') return 'approved';
  if (s === 'declined' || s === 'failed') return 'declined';
  if (s === 'needs_review' || s === 'completed') return 'review';
  return 'pending';
}

export async function getInquiry(id: string) {
  const r = await call(`/inquiries/${id}`);
  return { status: mapStatus(r.data.attributes.status), referenceId: r.data.attributes['reference-id'] as string | null };
}

/** Lightweight connection test: list one inquiry. */
export async function testPersona() {
  await call('/inquiries?page%5Bsize%5D=1');
  return 'Connected to Persona';
}

/** Verify the Persona-Signature header: "t=<ts>,v1=<hmac>" over "<ts>.<raw body>". */
export async function verifyWebhook(raw: string, header: string | null) {
  const secret = (await getIntegration('persona')).secrets.webhook_secret;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
