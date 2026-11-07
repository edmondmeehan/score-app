import 'server-only';
import { supabaseAnon } from '@/lib/supabase/server';

export type Provider = 'persona' | 'aws' | 'revenuecat' | 'apple' | 'google' | 'credit' | 'email' | 'spotify';
export type Integration = { enabled: boolean; config: Record<string, any>; secrets: Record<string, string> };

/** Env vars win (useful for local dev); otherwise read from the admin Integrations settings (Vault). */
const ENV: Record<string, Record<string, string | undefined>> = {
  persona: { api_key: process.env.PERSONA_API_KEY, webhook_secret: process.env.PERSONA_WEBHOOK_SECRET, template_id: process.env.PERSONA_TEMPLATE_ID },
  aws: { access_key_id: process.env.AWS_ACCESS_KEY_ID, secret_access_key: process.env.AWS_SECRET_ACCESS_KEY, region: process.env.AWS_REGION },
  revenuecat: { secret_api_key: process.env.REVENUECAT_SECRET_API_KEY, webhook_auth: process.env.REVENUECAT_WEBHOOK_AUTH },
};

const cache = new Map<string, { at: number; v: Integration }>();

export async function getIntegration(p: Provider): Promise<Integration> {
  const hit = cache.get(p);
  if (hit && Date.now() - hit.at < 30_000) return hit.v;
  let v: Integration = { enabled: false, config: {}, secrets: {} };
  if (process.env.SCORE_SERVER_SECRET && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { data } = await supabaseAnon().rpc('get_integration', { p_server_secret: process.env.SCORE_SERVER_SECRET, p_provider: p });
    if (data) v = { enabled: Boolean(data.enabled), config: data.config || {}, secrets: data.secrets || {} };
  }
  const env = ENV[p] || {};
  for (const [k, val] of Object.entries(env)) {
    if (!val) continue;
    if (k === 'template_id' || k === 'region') v.config[k] = val; else v.secrets[k] = val;
    v.enabled = true;
  }
  cache.set(p, { at: Date.now(), v });
  return v;
}

export async function recordTest(p: Provider, ok: boolean, message: string) {
  await supabaseAnon().rpc('record_integration_test', { p_server_secret: process.env.SCORE_SERVER_SECRET, p_provider: p, p_ok: ok, p_message: message });
  cache.delete(p);
}
