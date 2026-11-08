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

export type PersonaCheck = { name: string; status: string; reasons: string[] };
export type PersonaDetails = {
  id: string; status: string; createdAt?: string; completedAt?: string; dashboardUrl: string;
  name?: string; birthdate?: string; address?: string;
  documents: { kind: string; status: string; idClass?: string; country?: string; name?: string; birthdate?: string; expires?: string; checks: PersonaCheck[] }[];
  selfies: { status: string; checks: PersonaCheck[] }[];
  sessions: { ip?: string; location?: string; lat?: number; lng?: number; device?: string; browser?: string; os?: string; isp?: string; flags: string[]; at?: string }[];
};

/** Live inquiry details for staff review. Nothing here is copied into our database. */
export async function getInquiryDetails(id: string): Promise<PersonaDetails> {
  const r = await call(`/inquiries/${encodeURIComponent(id)}?include=verifications,sessions`);
  const a = r.data?.attributes || {};
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const join = (...v: unknown[]) => v.map(s).filter(Boolean).join(', ') || undefined;
  const checks = (c: any[] | undefined): PersonaCheck[] =>
    (c || []).filter((x) => x && x.status && x.status !== 'not_applicable').map((x) => ({ name: String(x.name || '').replace(/_/g, ' '), status: String(x.status), reasons: (x.reasons || []).map((y: unknown) => String(y).replace(/_/g, ' ')) }));
  const included: any[] = r.included || [];
  const documents = included.filter((x) => /^verification\/(government-id|document)/.test(x.type)).map((x) => {
    const v = x.attributes || {};
    return {
      kind: x.type.split('/')[1], status: String(v.status || ''), idClass: s(v['id-class']), country: s(v['issuing-country'] || v['country-code']),
      name: join(v['name-first'], v['name-middle'], v['name-last'])?.replace(/, /g, ' '), birthdate: s(v.birthdate), expires: s(v['expiration-date']),
      checks: checks(v.checks),
    };
  });
  const selfies = included.filter((x) => /^verification\/selfie/.test(x.type)).map((x) => ({ status: String(x.attributes?.status || ''), checks: checks(x.attributes?.checks) }));
  const sessions = included.filter((x) => x.type === 'inquiry-session').map((x) => {
    const v = x.attributes || {};
    const flags = [
      v['is-vpn'] && 'VPN', v['is-proxy'] && 'Proxy', v['is-tor'] && 'Tor', v['is-datacenter'] && 'Data center IP',
      s(v['threat-level']) && v['threat-level'] !== 'low' && `Threat: ${v['threat-level']}`,
    ].filter(Boolean) as string[];
    const lat = Number(v['latitude'] ?? v['gps-latitude']); const lng = Number(v['longitude'] ?? v['gps-longitude']);
    return {
      ip: s(v['ip-address']), location: join(v['city-name'] || v['city'], v['region-name'] || v['region-code'], v['country-name'] || v['country-code']),
      lat: Number.isFinite(lat) && lat !== 0 ? lat : undefined, lng: Number.isFinite(lng) && lng !== 0 ? lng : undefined,
      device: join(v['device-name'], v['device-type']), browser: join(v['browser-name'], v['browser-full-version'])?.replace(', ', ' '),
      os: join(v['os-name'], v['os-full-version'])?.replace(', ', ' '), isp: s(v['ip-isp'] || v['ip-connection-type']), flags, at: s(v['created-at']),
    };
  });
  return {
    id, status: String(a.status || ''), createdAt: s(a['created-at']), completedAt: s(a['completed-at']),
    dashboardUrl: `https://app.withpersona.com/dashboard/inquiries/${encodeURIComponent(id)}`,
    name: join(a['name-first'], a['name-middle'], a['name-last'])?.replace(/, /g, ' '), birthdate: s(a.birthdate),
    address: join(a['address-street-1'], a['address-city'], a['address-subdivision'], a['address-postal-code']),
    documents, selfies, sessions,
  };
}
