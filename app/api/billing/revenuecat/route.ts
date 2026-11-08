import { contactFor, sendEmail } from '@/lib/mailer';
import { NextResponse } from 'next/server';
import { getIntegration } from '@/lib/integrations';
import { activeEntitlements, isPreviewProduct, planFromEntitlements } from '@/lib/revenuecat';
import { supabaseAnon } from '@/lib/supabase/server';

// RevenueCat → ScoreDate. In RevenueCat: Project settings → Integrations → Webhooks.
//   URL: https://<domain>/api/billing/revenuecat
//   Authorization header: the "Webhook authorization" value from ScoreDate admin → Integrations → RevenueCat.
// The iPhone/Android apps must log in to RevenueCat with the Supabase user ID as the app user ID.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const rc = await getIntegration('revenuecat');
  const auth = req.headers.get('authorization') || '';
  if (!rc.secrets.webhook_auth || (auth !== rc.secrets.webhook_auth && auth !== `Bearer ${rc.secrets.webhook_auth}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const e = body?.event;
  if (!e?.id || !e?.type) return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  if (e.type === 'TEST') return NextResponse.json({ ok: true, test: true });

  const candidates: string[] = [e.app_user_id, e.original_app_user_id, ...(e.aliases || [])].filter(Boolean);
  const userId = candidates.find((c) => UUID.test(c));
  if (!userId) return NextResponse.json({ ok: true, skipped: 'no ScoreDate user id' });

  // Source of truth: ask RevenueCat what's active now. Fall back to the event itself.
  let plan: string;
  const live = await activeEntitlements(userId);
  if (live) {
    plan = await planFromEntitlements(live);
  } else if (['EXPIRATION'].includes(e.type)) {
    plan = 'none';
  } else if (['CANCELLATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED'].includes(e.type)) {
    plan = 'unchanged';
  } else {
    plan = await planFromEntitlements(e.entitlement_ids || (e.entitlement_id ? [e.entitlement_id] : []));
  }
  if ((e.type === 'NON_RENEWING_PURCHASE' || e.type === 'INITIAL_PURCHASE') && (await isPreviewProduct(e.product_id)) && plan === 'none') plan = 'preview';

  const { data, error } = await supabaseAnon().rpc('record_billing_event', {
    p_server_secret: process.env.SCORE_SERVER_SECRET,
    p_event_id: String(e.id),
    p_user: userId,
    p_type: String(e.type),
    p_store: e.store ?? null,
    p_product: e.product_id ?? null,
    p_entitlement: (e.entitlement_ids || [])[0] ?? null,
    p_plan: plan === 'unchanged' ? null : plan,
    p_expires: e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null,
    p_environment: e.environment ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Revenue for the admin command center. RevenueCat sends USD price (negative on refunds) and the share kept after store fees.
  if (data === 'ok' && typeof e.price === 'number') {
    await supabaseAnon().rpc('billing_event_amount', {
      p_secret: process.env.SCORE_SERVER_SECRET, p_event_id: String(e.id), p_price: e.price,
      p_takehome: typeof e.takehome_percentage === 'number' ? e.takehome_percentage : null, p_currency: e.currency ?? null, p_country: e.country_code ?? null,
    }).then(() => null, () => null);
  }
  if (data === 'ok' && plan === 'none' && e.type === 'EXPIRATION') {
    const c = await contactFor(userId);
    await sendEmail(c.email, 'plan_ended', { first_name: c.first_name });
  }
  return NextResponse.json({ ok: true, result: data });
}
