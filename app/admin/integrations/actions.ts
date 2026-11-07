'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { SPECS, setPath } from '@/lib/integrationSpecs';
import { recordTest } from '@/lib/integrations';
import { testPersona } from '@/lib/persona';
import { testRevenueCat } from '@/lib/revenuecat';
import { testResend } from '@/lib/mailer';
import { testSpotify } from '@/lib/spotify';
import { testCarto } from '@/lib/basemap';

export async function saveIntegration(form: FormData) {
  const provider = String(form.get('provider'));
  const spec = SPECS.find((s) => s.provider === provider);
  if (!spec) redirect('/admin/integrations?error=unknown');
  const supabase = await supabaseServer();
  const { data: row } = await supabase.from('integrations').select('config').eq('provider', provider).single();
  const config = structuredClone(row?.config || {});
  for (const f of spec.fields.filter((x) => !x.secret)) setPath(config, f.key, String(form.get(`cfg:${f.key}`) ?? '').trim());
  const { error } = await supabase.rpc('set_integration_config', { p_provider: provider, p_config: config, p_enabled: form.get('enabled') === 'on' });
  if (error) redirect(`/admin/integrations?error=${encodeURIComponent(error.message)}#${provider}`);
  for (const f of spec.fields.filter((x) => x.secret)) {
    const v = String(form.get(`sec:${f.key}`) ?? '');
    const clear = form.get(`clear:${f.key}`) === 'on';
    if (v || clear) {
      const { error: e2 } = await supabase.rpc('set_integration_secret', { p_provider: provider, p_name: f.key, p_value: clear ? '' : v.trim() });
      if (e2) redirect(`/admin/integrations?error=${encodeURIComponent(e2.message)}#${provider}`);
    }
  }
  revalidatePath('/admin/integrations');
  redirect(`/admin/integrations?saved=${provider}#${provider}`);
}

export async function testIntegration(form: FormData) {
  const provider = String(form.get('provider'));
  const supabase = await supabaseServer();
  const { data: role } = await supabase.rpc('staff_role');
  if (role !== 'owner') redirect('/admin/integrations?error=owner%20only');
  let ok = false; let msg = '';
  try {
    msg = provider === 'persona' ? await testPersona() : provider === 'revenuecat' ? await testRevenueCat() : provider === 'email' ? await testResend() : provider === 'spotify' ? await testSpotify() : provider === 'carto' ? await testCarto() : 'No test available';
    ok = true;
  } catch (e) {
    msg = e instanceof Error ? e.message : 'Test failed';
  }
  await recordTest(provider as never, ok, msg);
  revalidatePath('/admin/integrations');
  redirect(`/admin/integrations#${provider}`);
}
